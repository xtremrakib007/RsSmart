import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create(AppModule, {
    // Avoid debug/verbose logs in production; never log request bodies or secrets.
    logger: isProduction ? ['error', 'warn', 'log'] : ['error', 'warn', 'log', 'debug', 'verbose'],
    rawBody: true,
  });

  app.enableShutdownHooks();

  // Security
  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map((v) => v.trim()).filter(Boolean) : false,
    credentials: true,
  });

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global interceptors & filters
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // Keep interactive API documentation out of production by default.
  // Production API docs can expose route structure and should be deliberately
  // enabled only behind an authenticated access layer if required.
  if (!isProduction) {
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
      // Do not persist bearer tokens in browser storage.
      swaggerOptions: { persistAuthorization: false },
    });
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Server running on port ${port}`);
  if (!isProduction) console.log(`📚 Swagger docs on http://localhost:${port}/api/docs`);
}
bootstrap();
