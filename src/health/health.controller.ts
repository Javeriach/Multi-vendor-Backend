import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';

/**
 * Deliberately excluded from the global "api" prefix (see main.ts) and from
 * auth — Render's health check hits this directly at /health with no
 * credentials, before the app is known to be fully up.
 */
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
