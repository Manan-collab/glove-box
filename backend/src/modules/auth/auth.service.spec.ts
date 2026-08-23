import { UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { AuthService } from './auth.service';

jest.mock('google-auth-library');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock } };
  let jwt: { sign: jest.Mock };
  let config: { getOrThrow: jest.Mock };
  let verifyIdToken: jest.Mock;

  const CONFIG_VALUES: Record<string, string> = {
    'google.clientId': 'test-client-id',
    'jwt.secret': 'test-access-secret',
    'jwt.refreshSecret': 'test-refresh-secret',
  };

  beforeEach(() => {
    verifyIdToken = jest.fn();
    (OAuth2Client as unknown as jest.Mock).mockImplementation(() => ({
      verifyIdToken,
    }));

    prisma = { user: { findUnique: jest.fn(), create: jest.fn() } };
    jwt = { sign: jest.fn().mockReturnValue('signed-token') };
    config = {
      getOrThrow: jest.fn((key: string) => CONFIG_VALUES[key]),
    };

    service = new AuthService(prisma as any, jwt as any, config as any);
  });

  describe('authenticateWithGoogle', () => {
    it('creates a new user with an email-derived username on first sign-in', async () => {
      verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-sub-123',
          email: 'manan.mer@example.com',
          name: 'Manan Mer',
          picture: 'https://example.com/avatar.png',
        }),
      });
      prisma.user.findUnique.mockImplementation(({ where }: any) => {
        if (where.googleId) return Promise.resolve(null);
        if (where.username === 'mananmer') return Promise.resolve(null);
        return Promise.resolve(null);
      });
      const createdUser = {
        id: 'user-1',
        email: 'manan.mer@example.com',
        username: 'mananmer',
        googleId: 'google-sub-123',
        displayName: 'Manan Mer',
        avatarUrl: 'https://example.com/avatar.png',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.user.create.mockResolvedValue(createdUser);

      const result = await service.authenticateWithGoogle('valid-credential');

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          googleId: 'google-sub-123',
          email: 'manan.mer@example.com',
          username: 'mananmer',
        }),
      });
      expect(result.user).toEqual({
        id: 'user-1',
        email: 'manan.mer@example.com',
        username: 'mananmer',
        displayName: 'Manan Mer',
        avatarUrl: 'https://example.com/avatar.png',
        createdAt: createdUser.createdAt,
      });
      expect(result.user).not.toHaveProperty('googleId');
      expect(result.tokens).toEqual({
        accessToken: 'signed-token',
        refreshToken: 'signed-token',
      });
      expect(jwt.sign).toHaveBeenCalledWith(
        { sub: 'user-1' },
        expect.objectContaining({
          secret: 'test-access-secret',
          expiresIn: '15m',
        }),
      );
      expect(jwt.sign).toHaveBeenCalledWith(
        { sub: 'user-1' },
        expect.objectContaining({
          secret: 'test-refresh-secret',
          expiresIn: '7d',
        }),
      );
    });

    it('appends a numeric suffix when the derived username is already taken', async () => {
      verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-sub-456',
          email: 'manan.mer@example.com',
        }),
      });
      prisma.user.findUnique.mockImplementation(({ where }: any) => {
        if (where.googleId) return Promise.resolve(null);
        if (where.username === 'mananmer') {
          return Promise.resolve({ id: 'someone-else' });
        }
        return Promise.resolve(null);
      });
      prisma.user.create.mockResolvedValue({
        id: 'user-2',
        email: 'manan.mer@example.com',
        username: 'mananmer1234',
        googleId: 'google-sub-456',
        displayName: null,
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.authenticateWithGoogle('valid-credential');

      const [[createArgs]] = prisma.user.create.mock.calls;
      expect(createArgs.data.username).toMatch(/^mananmer\d{4}$/);
    });

    it('logs in an existing user without creating a new row', async () => {
      verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-sub-123',
          email: 'manan.mer@example.com',
        }),
      });
      const existingUser = {
        id: 'user-1',
        email: 'manan.mer@example.com',
        username: 'mananmer',
        googleId: 'google-sub-123',
        displayName: null,
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.user.findUnique.mockResolvedValue(existingUser);

      const result = await service.authenticateWithGoogle('valid-credential');

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(result.user.id).toBe('user-1');
    });

    it('throws Unauthorized when the Google credential fails verification', async () => {
      verifyIdToken.mockRejectedValue(new Error('bad signature'));

      await expect(service.authenticateWithGoogle('garbage')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws Unauthorized when the payload is missing sub/email', async () => {
      verifyIdToken.mockResolvedValue({ getPayload: () => ({}) });

      await expect(
        service.authenticateWithGoogle('valid-credential'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshAccessToken', () => {
    it('issues new tokens for an existing user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'manan.mer@example.com',
        username: 'mananmer',
        displayName: null,
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.refreshAccessToken('user-1');

      expect(result.tokens).toEqual({
        accessToken: 'signed-token',
        refreshToken: 'signed-token',
      });
    });

    it('throws Unauthorized if the user no longer exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.refreshAccessToken('ghost')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
