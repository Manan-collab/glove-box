import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { toSafeUser } from './utils/to-safe-user';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';

@Injectable()
export class AuthService {
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.googleClient = new OAuth2Client(
      this.config.getOrThrow<string>('google.clientId'),
    );
  }

  async authenticateWithGoogle(credential: string) {
    const payload = await this.verifyGoogleCredential(credential);
    const user = await this.findOrCreateUser(payload);
    const tokens = this.issueTokens(user.id);
    return { user: toSafeUser(user), tokens };
  }

  async refreshAccessToken(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    return { user: toSafeUser(user), tokens: this.issueTokens(user.id) };
  }

  private async verifyGoogleCredential(
    credential: string,
  ): Promise<TokenPayload> {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: credential,
        audience: this.config.getOrThrow<string>('google.clientId'),
      });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email) {
        throw new UnauthorizedException('Invalid Google credential');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid Google credential');
    }
  }

  private async findOrCreateUser(payload: TokenPayload) {
    const existing = await this.prisma.user.findUnique({
      where: { googleId: payload.sub },
    });
    if (existing) return existing;

    const username = await this.generateUsername(payload.email!);
    // No $transaction here — see Section 0's Prisma driver-adapter gotcha.
    // Google's credential callback can fire twice in some browser/FedCM
    // configurations, so two concurrent sign-ins can both pass the
    // findUnique check above and both attempt create(); the loser hits a
    // unique-constraint conflict on googleId/email rather than a real error
    // — treat that as a successful sign-in and return the row the other
    // request created, instead of surfacing it as a failed login.
    try {
      return await this.prisma.user.create({
        data: {
          googleId: payload.sub,
          email: payload.email!,
          username,
          displayName: payload.name,
          avatarUrl: payload.picture,
        },
      });
    } catch (error) {
      const isDuplicate =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002';
      if (!isDuplicate) {
        throw error;
      }
      const winner = await this.prisma.user.findUnique({
        where: { googleId: payload.sub },
      });
      if (!winner) throw error;
      return winner;
    }
  }

  private async generateUsername(email: string): Promise<string> {
    const base =
      email
        .split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '') || 'user';

    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate =
        attempt === 0
          ? base
          : `${base}${Math.floor(1000 + Math.random() * 9000)}`;
      const existing = await this.prisma.user.findUnique({
        where: { username: candidate },
      });
      if (!existing) return candidate;
    }
    throw new Error('Could not generate a unique username');
  }

  private issueTokens(userId: string) {
    const accessToken = this.jwt.sign(
      { sub: userId },
      {
        secret: this.config.getOrThrow<string>('jwt.secret'),
        expiresIn: ACCESS_TOKEN_TTL,
      },
    );
    const refreshToken = this.jwt.sign(
      { sub: userId },
      {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: REFRESH_TOKEN_TTL,
      },
    );
    return { accessToken, refreshToken };
  }
}
