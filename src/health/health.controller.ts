import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ChatGateway } from '../chat/chat.gateway';
import { Public } from '../common/decorators/public.decorator';

interface CheckResult {
  status: 'ok' | 'error';
  latencyMs?: number;
  message?: string;
}

interface HealthReport {
  status: 'ok' | 'error';
  timestamp: string;
  uptimeSeconds: number;
  checks: {
    database: CheckResult;
    websocket: CheckResult;
  };
}

/**
 * Deliberately excluded from the global "api" prefix (see create-app.ts)
 * and from auth — Render/Vercel/uptime monitors hit this directly with no
 * credentials, before the app is known to be fully up. Registered at BOTH
 * `/` and `/health` (see create-app.ts's prefix exclude list) so visiting
 * the bare domain root doesn't 404 — some uptime checkers and casual
 * "is it alive" visits hit `/` by default, not `/health`.
 *
 * Actually exercises each dependency rather than just returning a static
 * "ok" — a process that's technically running but can't reach its
 * database, or whose WebSocket gateway never finished initializing, is
 * NOT healthy even though it can still answer HTTP requests. Returns 503
 * (not 200) when any check fails, so platform-level health checks
 * (Render's health check path, uptime monitors) correctly detect and act
 * on a genuinely broken instance instead of treating it as up.
 */
@Controller()
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Public()
  @Get('health')
  health(): Promise<HealthReport> {
    return this.runChecks();
  }

  @Public()
  @Get()
  root(): Promise<HealthReport> {
    return this.runChecks();
  }

  private async runChecks(): Promise<HealthReport> {
    const [database, websocket] = await Promise.all([this.checkDatabase(), this.checkWebSocket()]);
    const overallStatus: 'ok' | 'error' = database.status === 'ok' && websocket.status === 'ok' ? 'ok' : 'error';

    const report: HealthReport = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      checks: { database, websocket },
    };

    if (overallStatus === 'error') {
      // HttpException's first argument becomes the response body verbatim
      // — the caller gets the full breakdown (which check failed and why),
      // not just a bare 503.
      throw new HttpException(report, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return Promise.resolve(report);
  }

  /** A real round-trip query, not just "is the pool object truthy" — a
   * pool can exist while every connection in it is broken (e.g. Neon
   * paused the endpoint, or credentials rotated), which a query surfaces
   * and a truthiness check would miss entirely. */
  private async checkDatabase(): Promise<CheckResult> {
    const start = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', latencyMs: Date.now() - start };
    } catch (error) {
      return { status: 'error', message: (error as Error).message };
    }
  }

  /** The gateway's `server` (the Socket.IO Server instance) only exists
   * once IoAdapter has attached it during Nest's WS module bootstrap —
   * checking it catches the exact failure mode that motivated this
   * endpoint in the first place: a deploy where the HTTP side comes up
   * fine but the WebSocket layer silently never wired up (see the
   * api/index.js comments on why that's a real risk on Vercel). */
  private checkWebSocket(): CheckResult {
    if (!this.chatGateway.server) {
      return { status: 'error', message: 'Socket.IO server has not initialized' };
    }
    return { status: 'ok' };
  }
}
