import { Logger, ValidationPipe, type Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';
import helmet from 'helmet';
import {
  BODY_SIZE_LIMIT,
  corsOptions,
  helmetConfig,
  helmetConfigSwagger,
} from '../config/security.config';
import { AllExceptionsFilter } from '../filters/all-exceptions.filter';

export interface HttpAppBootstrapOptions {
  module: Type<unknown>;
  loggerName: string;
  swaggerTitle: string;
  swaggerDescription: string;
  defaultPort: number;
}

export async function bootstrapHttpApp(
  options: HttpAppBootstrapOptions,
): Promise<void> {
  const logger = new Logger(options.loggerName);
  const app = await NestFactory.create<NestExpressApplication>(options.module, {
    bodyParser: false,
  });

  const configService = app.get(ConfigService);
  const enableSwagger = configService.get<string>('ENABLE_SWAGGER') === 'true';

  app.use(helmet(enableSwagger ? helmetConfigSwagger : helmetConfig));
  app.use(express.json({ limit: BODY_SIZE_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: BODY_SIZE_LIMIT }));
  app.enableShutdownHooks();
  app.setGlobalPrefix('api/v1');
  app.enableCors(corsOptions(configService.get<string>('ALLOWED_ORIGINS')));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  if (enableSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle(options.swaggerTitle)
      .setDescription(options.swaggerDescription)
      .setVersion('1.0.0')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/v1/docs', app, document);
    logger.log('Swagger docs available at /api/v1/docs');
  }

  const port = configService.get<number>('PORT') ?? options.defaultPort;
  await app.listen(port, '0.0.0.0');
  logger.log(`Application running on 0.0.0.0:${String(port)}`);
}
