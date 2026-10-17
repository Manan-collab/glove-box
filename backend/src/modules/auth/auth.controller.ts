import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import type { SafeUser } from './utils/to-safe-user';

const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async googleAuth(
    @Body() dto: GoogleAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.authService.authenticateWithGoogle(
      dto.credential,
    );
    this.setAuthCookies(res, tokens);
    return { user };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: SafeUser) {
    return { user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  async refresh(
    @CurrentUser() user: { id: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user: safeUser, tokens } =
      await this.authService.refreshAccessToken(user.id);
    this.setAuthCookies(res, tokens);
    return { user: safeUser };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    const shared = this.authCookieOptions();
    res.clearCookie('access_token', shared);
    res.clearCookie('refresh_token', shared);
    return { success: true };
  }

  private authCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get<boolean>('app.cookieSecure') ?? false,
      // The frontend proxies /api/v1 to us (frontend/next.config.ts), so these
      // are first-party cookies on the frontend's origin. Lax keeps other
      // sites from riding them on cross-site form POSTs (CSRF). Don't go back
      // to calling the API cross-site with SameSite=None: iOS drops
      // third-party cookies and login breaks there.
      sameSite: 'lax',
      path: '/',
    };
  }

  private setAuthCookies(
    res: Response,
    tokens: { accessToken: string; refreshToken: string },
  ) {
    const shared = this.authCookieOptions();
    res.cookie('access_token', tokens.accessToken, {
      ...shared,
      maxAge: ACCESS_TOKEN_MAX_AGE_MS,
    });
    res.cookie('refresh_token', tokens.refreshToken, {
      ...shared,
      maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    });
  }
}
