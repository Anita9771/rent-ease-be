import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalFilters(new GlobalExceptionFilter());
  const config = app.get(ConfigService);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );

  const frontendUrl =
    config.get<string>('FRONTEND_URL') ?? config.get<string>('frontendUrl') ?? 'http://localhost:3000';
  const nodeEnv = config.get<string>('NODE_ENV') ?? config.get<string>('nodeEnv') ?? 'development';
  const devOrigins = new Set([
    frontendUrl,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
  ]);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (nodeEnv === 'development' && devOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      if (origin === frontendUrl) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  });

  app.useStaticAssets(join(process.cwd(), config.get<string>('storage.uploadsDir') ?? 'uploads'), {
    prefix: '/uploads/',
  });

  const port = config.get<number>('PORT') ?? 4000;
  await app.listen(port);
  Logger.log(`🚀 RentEase API running at http://localhost:${port}/${globalPrefix}`);
}

bootstrap().catch((error) => {
  Logger.error('Failed to bootstrap RentEase API', error);
  process.exit(1);
});

