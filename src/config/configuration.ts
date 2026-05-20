export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),
  backendUrl: process.env.BACKEND_URL ?? 'http://localhost:4000',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/rentease',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change-me-too',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  stripe: {
    apiKey: process.env.STRIPE_API_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  },
  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY ?? '',
    publicKey: process.env.PAYSTACK_PUBLIC_KEY ?? '',
    webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET ?? '',
  },
  email: {
    provider: process.env.EMAIL_PROVIDER ?? 'resend',
    apiKey: process.env.EMAIL_API_KEY ?? '',
    from: process.env.EMAIL_FROM ?? 'RentEase <no-reply@rentease.com>',
  },
  storage: {
    bucket: process.env.S3_BUCKET ?? 'rentease-assets',
    region: process.env.S3_REGION ?? 'us-east-1',
    uploadsDir: process.env.UPLOADS_DIR ?? 'uploads',
  },
});

