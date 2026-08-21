import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true preserves req.rawBody as a Buffer on every request (in
  // addition to the normal parsed body) — the Stripe webhook controller
  // needs the untouched raw bytes to verify the signature; nothing else
  // uses it.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  app.use(cookieParser());

  // Vendor-uploaded product photos (see UploadsModule) — served outside the
  // /api prefix since these are static files, not API routes.
  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' });

  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  });

  // /health stays outside the /api prefix — Render's health check probes it
  // directly at that exact path.
  app.setGlobalPrefix('api', { exclude: ['health'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown properties — never trust extra client-supplied fields
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(config.get<number>('PORT', 4000));
}
bootstrap();
