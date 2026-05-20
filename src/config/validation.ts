import Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().default(4000),
  FRONTEND_URL: Joi.string().uri().required(),
  DATABASE_URL: Joi.string().uri().required(),
  REDIS_URL: Joi.string().uri().required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  STRIPE_API_KEY: Joi.string().allow('', null),
  STRIPE_WEBHOOK_SECRET: Joi.string().allow('', null),
  PAYSTACK_SECRET_KEY: Joi.string().allow('', null),
  PAYSTACK_PUBLIC_KEY: Joi.string().allow('', null),
  PAYSTACK_WEBHOOK_SECRET: Joi.string().allow('', null),
  EMAIL_PROVIDER: Joi.string().default('resend'),
  EMAIL_API_KEY: Joi.string().allow('', null),
  EMAIL_FROM: Joi.string().default('RentEase <no-reply@rentease.com>'),
  S3_BUCKET: Joi.string().default('rentease-assets'),
  S3_REGION: Joi.string().default('us-east-1'),
});

