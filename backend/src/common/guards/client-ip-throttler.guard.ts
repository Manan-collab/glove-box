import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

// Browser traffic reaches us through the frontend's /api/v1 proxy on Vercel,
// so req.ip is a Vercel egress IP shared by many users — keying on it would
// put everyone in one bucket (and the 5/min POST /auth/google limit would lock
// out sign-in for the whole app). Vercel overwrites x-vercel-forwarded-for
// with the real client IP, so a browser can't spoof it through the proxy.
// Requests sent straight to the API host can still set it themselves; this is
// abuse-dampening, not an auth boundary.
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Request): Promise<string> {
    const forwarded = req.headers['x-vercel-forwarded-for'];
    const clientIp = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
      ?.split(',')[0]
      ?.trim();
    return Promise.resolve(clientIp || req.ip || 'unknown');
  }
}
