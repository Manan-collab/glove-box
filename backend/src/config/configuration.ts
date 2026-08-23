function isLocalFrontend(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return true;
  }
}

export default () => {
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001';
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  // Auth cookies are scoped to the API host (Render). Any non-localhost
  // frontend (Vercel) sends credentialed fetches cross-site, so cookies
  // must be SameSite=None; Secure — even if NODE_ENV was left as
  // "development" on the deploy platform.
  const cookieCrossSite =
    nodeEnv === 'production' || !isLocalFrontend(frontendUrl);

  return {
    app: {
      port: parseInt(process.env.PORT ?? '3000', 10),
      nodeEnv,
      frontendUrl,
      cookieCrossSite,
    },
    database: {
      url: process.env.DATABASE_URL,
    },
    jwt: {
      secret: process.env.JWT_SECRET,
      refreshSecret: process.env.JWT_REFRESH_SECRET,
    },
    google: { clientId: process.env.GOOGLE_CLIENT_ID },
  };
};
