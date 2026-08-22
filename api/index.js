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
 * Every request (per vercel.json's rewrite) lands here regardless of path
 * — /health, /api/products, /api/webhooks/stripe, all of it — handed to
 * the same Express instance Nest builds for local dev/Render, just via
 * .init() instead of .listen() since there's no port to bind on a
 * serverless platform. cachedApp survives across warm invocations of the
 * same function instance, so most requests skip re-running the whole Nest
 * bootstrap — only a cold start pays that cost.
 */
const { createApp } = require('../dist/create-app');

let cachedAppPromise;

function getApp() {
  if (!cachedAppPromise) {
    cachedAppPromise = createApp().then(async (app) => {
      await app.init();
      return app;
    });
  }
  return cachedAppPromise;
}

module.exports = async function handler(req, res) {
  const app = await getApp();
  const expressInstance = app.getHttpAdapter().getInstance();
  expressInstance(req, res);
};
