import { timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

export const PROXY_SECRET_HEADER = 'x-glovebox-proxy-secret';
export const CLIENT_IP_HEADER = 'x-glovebox-client-ip';

// Browser traffic reaches us through the frontend's /api/v1 proxy on Vercel,
// so req.ip is a Vercel egress IP shared by many users — keying on it would
// put everyone in one bucket (and the 5/min POST /auth/google limit would lock
// out sign-in for the whole app). The frontend's proxy.ts forwards the real
// client IP alongside a shared secret. The forwarded IP is only trusted when
// the secret matches, so a request sent straight to this host can't pick its
// own rate-limit key by faking the header.
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  // Property injection: ThrottlerGuard's constructor already takes the
  // throttler's own providers, and re-declaring it here would mean re-wiring
  // its internal injection tokens.
  @Inject(ConfigService)
  private readonly config!: ConfigService;

  protected getTracker(req: Request): Promise<string> {
    const forwardedIp = this.trustedForwardedIp(req);
    return Promise.resolve(forwardedIp ?? req.ip ?? 'unknown');
  }

  private trustedForwardedIp(req: Request): string | undefined {
    const secret = this.config.get<string>('proxy.secret');
    const provided = req.headers[PROXY_SECRET_HEADER];
    if (!secret || typeof provided !== 'string') return undefined;

    const expected = Buffer.from(secret);
    const actual = Buffer.from(provided);
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      return undefined;
    }

    const clientIp = req.headers[CLIENT_IP_HEADER];
    return typeof clientIp === 'string' && clientIp.trim()
      ? clientIp.trim()
      : undefined;
  }
}
