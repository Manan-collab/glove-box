import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  FRONTEND_URL: z.url().default('http://localhost:3001'),
  GOOGLE_CLIENT_ID: z.string().min(1),
  // Shared with the frontend's proxy (frontend/proxy.ts). Optional so local
  // dev works without it; unset means every client is rate-limited by the IP
  // that connects to us, which behind the proxy is Vercel's.
  API_PROXY_SECRET: z.string().min(32).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validate(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${result.error.toString()}`,
    );
  }
  return result.data;
}
