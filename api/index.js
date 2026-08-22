/**
 * Vercel serverless entry point. Deliberately plain JS requiring the
 * ALREADY tsc-COMPILED output (dist/create-app.js, built by `npm run
 * build` before deploy — see vercel.json's buildCommand) rather than
 * letting Vercel esbuild-transpile a .ts file itself: esbuild does not
 * support TypeScript's `emitDecoratorMetadata`, which NestJS's dependency
 * injection depends on, so a raw .ts function entry here would silently
 * break DI (undefined providers) once deployed. tsc (via `nest build`)
 * emits that metadata correctly; this file just reuses that output.
 *
 * Exports the raw http.Server, not a (req, res) => {} handler function —
 * this is load-bearing for WebSocket support. Vercel's Fluid Compute
 * routes an incoming WS handshake as a raw 'upgrade' event on the
 * function's underlying server; a plain request-handler function has no
 * such event to listen on, so REST would work but the /chat gateway would
 * silently never receive a single connection. Exporting the actual
 * http.Server — the same one create-app.ts's IoAdapter attaches Socket.IO
 * to — lets Vercel wire upgrade requests straight to Socket.IO exactly
 * like a normal long-running Node process would (see main.ts/Render).
 *
 * The server has to exist synchronously at module load (Vercel reads the
 * export immediately), but Nest's bootstrap (DB connection, module
 * wiring) is unavoidably async — so this creates a bare server up front
 * and queues any request/upgrade that arrives before bootstrap finishes,
 * replaying them once the real Nest-managed server is ready. In practice
 * that queue is empty almost every time except the very first cold start.
 */
const http = require('http');
const { createApp } = require('../dist/create-app');

const server = http.createServer();
const pending = [];
let target = null;

server.on('request', (req, res) => {
  if (target) target.emit('request', req, res);
  else pending.push(['request', req, res]);
});

server.on('upgrade', (req, socket, head) => {
  if (target) target.emit('upgrade', req, socket, head);
  else pending.push(['upgrade', req, socket, head]);
});

createApp()
  .then(async (app) => {
    await app.init();
    target = app.getHttpServer();
    for (const [event, ...args] of pending.splice(0)) {
      target.emit(event, ...args);
    }
  })
  .catch((err) => {
    // Nothing can serve requests if bootstrap itself failed — surfacing
    // this loudly in function logs beats every request hanging silently
    // forever waiting on a `target` that will never arrive.
    // eslint-disable-next-line no-console
    console.error('FATAL: Nest bootstrap failed', err);
  });

module.exports = server;
