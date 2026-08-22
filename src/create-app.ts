import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

/**
 * Shared by main.ts (local dev / Render — calls .listen()) and
 * api/index.ts (Vercel serverless — calls .init() and reuses the instance
 * across warm invocations) so the two never configure the app differently.
 */
export async function createApp(): Promise<NestExpressApplication> {
  // rawBody: true preserves req.rawBody as a Buffer on every request (in
  // addition to the normal parsed body) — the Stripe webhook controller
  // needs the untouched raw bytes to verify the signature; nothing else
  // uses it.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  app.use(cookieParser());

  // Attaches Socket.IO to the same underlying HTTP server Express uses —
  // the ChatGateway's real-time chat rides on it. Without this, Nest has no
  // WebSocket transport wired up at all.
  app.useWebSocketAdapter(new IoAdapter(app));

  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  });

  // /health AND the bare root / both stay outside the /api prefix —
  // Render's health check (and uptime pings against a Vercel deployment)
  // probe /health directly, while a plain "is this thing alive" visit to
  // the domain root would otherwise 404 despite the app being perfectly
  // healthy (see HealthController, which serves the same real health
  // report at both paths).
  app.setGlobalPrefix('api', { exclude: ['health', '/'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown properties — never trust extra client-supplied fields
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  return app;
}
