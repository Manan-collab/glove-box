import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;
  let config: ConfigService;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(
      new AllExceptionsFilter(),
      new PrismaExceptionFilter(),
    );
    await app.init();

    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    config = app.get(ConfigService);
  });

  afterAll(async () => {
    if (createdUserIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await app.close();
  });

  function signAccessToken(userId: string) {
    return jwt.sign(
      { sub: userId },
      {
        secret: config.getOrThrow<string>('jwt.secret'),
        expiresIn: '15m',
      },
    );
  }

  describe('POST /auth/google', () => {
    it('rejects a malformed credential with 401', () => {
      return request(app.getHttpServer())
        .post('/auth/google')
        .send({ credential: 'not-a-real-token' })
        .expect(401);
    });

    it('rejects a request with no credential field with 400', () => {
      return request(app.getHttpServer())
        .post('/auth/google')
        .send({})
        .expect(400);
    });
  });

  describe('GET /auth/me', () => {
    it('returns 401 with no auth cookie', () => {
      return request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('returns the safe user for a valid access token cookie', async () => {
      const user = await prisma.user.create({
        data: {
          googleId: `e2e-google-${Date.now()}`,
          email: `e2e-user-${Date.now()}@example.com`,
          username: `e2euser${Date.now()}`,
        },
      });
      createdUserIds.push(user.id);

      const accessToken = signAccessToken(user.id);

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(response.body.user.id).toBe(user.id);
      expect(response.body.user.email).toBe(user.email);
      expect(response.body.user).not.toHaveProperty('googleId');
    });

    it('returns 401 for a token signed with the wrong secret', async () => {
      const forgedToken = jwt.sign(
        { sub: 'irrelevant' },
        { secret: 'wrong-secret', expiresIn: '15m' },
      );

      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', [`access_token=${forgedToken}`])
        .expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('returns 401 with no refresh cookie', () => {
      return request(app.getHttpServer()).post('/auth/refresh').expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('clears both auth cookies and returns success', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .expect(200);

      expect(response.body).toEqual({ success: true });
      const setCookieHeader = response.headers['set-cookie'] as unknown as
        string[] | undefined;
      expect(setCookieHeader?.some((c) => c.startsWith('access_token=;'))).toBe(
        true,
      );
      expect(
        setCookieHeader?.some((c) => c.startsWith('refresh_token=;')),
      ).toBe(true);
    });
  });
});
