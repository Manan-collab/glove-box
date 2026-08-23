import 'dotenv/config';
import { LogLevel, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { Express } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

const isProduction = process.env.NODE_ENV === 'production';
const logLevels: LogLevel[] = isProduction
  ? ['error', 'warn', 'log']
  : ['error', 'warn', 'log', 'debug', 'verbose'];

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: logLevels });
  const configService = app.get(ConfigService);

  // Deploy platforms (Render, Railway, etc.) sit behind a reverse proxy —
  // without this, every request appears to come from the proxy's internal
  // IP, which breaks per-client rate limiting (@nestjs/throttler uses req.ip).
  if (isProduction) {
    const expressApp = app.getHttpAdapter().getInstance() as Express;
    expressApp.set('trust proxy', 1);
  }

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: configService.get<string>('app.frontendUrl'),
    credentials: true,
  });

  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // Order matters: Nest checks global filters in REVERSE registration order,
  // so the more specific filter must be registered LAST to actually get a
  // chance before AllExceptionsFilter's bare @Catch() (which matches
  // everything) swallows the exception first.
  app.useGlobalFilters(new AllExceptionsFilter(), new PrismaExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Glovebox API')
    .setDescription('Car ownership and expense tracking platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('app.port') ?? 3000;
  await app.listen(port);
}
void bootstrap();
