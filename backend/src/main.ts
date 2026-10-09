import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

function getCorsOrigins(): string[] | false {
  const raw = process.env.CORS_ORIGINS;
  if (!raw?.trim()) return false;

  const origins = raw.split(',').map((value) => value.trim()).filter(Boolean);
  if (origins.includes('*')) {
    throw new Error('CORS_ORIGINS must list explicit origins; wildcard CORS is not supported.');
  }

  for (const origin of origins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`Invalid CORS origin configured: ${origin}`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) {
      throw new Error(`CORS origin must be a plain HTTP(S) origin without a path: ${origin}`);
    }
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      throw new Error('Production CORS origins must use HTTPS.');
    }
  }
  return origins;
}

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create(AppModule, {
    // Avoid debug/verbose request or framework detail in production logs.
    logger: isProduction ? ['error', 'warn', 'log'] : ['error', 'warn', 'log', 'debug', 'verbose'],
    rawBody: true,
  });

  app.enableShutdownHooks();

  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: getCorsOrigins(),
    credentials: true,
  });

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // API documentation is opt-in in production to reduce exposed attack surface.
  // If explicitly enabled, operators must protect it at the reverse proxy / identity layer.
  const swaggerEnabled = !isProduction || process.env.SWAGGER_ENABLED === 'true';
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Central Backend API')
      .setDescription('API for Sales App, ERP, and POS')
      .setVersion('1.0.0')
      .addBearerAuth()
      .addTag('Auth', 'Authentication & Authorization')
      .addTag('Users', 'User management')
      .addTag('Products', 'Product & inventory management')
      .addTag('Customers', 'Customer management')
      .addTag('Orders', 'Order management')
      .addTag('Sync', 'Offline sync engine')
      .addTag('Audit', 'Audit logs')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: false },
    });
  }

  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  await app.listen(port);
  console.log(`API server started on port ${port}`);
  if (swaggerEnabled) console.log('API documentation enabled at /api/docs');
}
bootstrap().catch((error) => {
  // Keep startup failure visible without dumping environment variables or credentials.
  console.error('API startup failed:', error instanceof Error ? error.message : 'Unknown startup error');
  process.exitCode = 1;
});
