/**
 * Local verification aid ONLY — starts a real embedded PostgreSQL server on
 * disk so migrations/build/boot can be validated without Docker or a system
 * install. Not part of the application; safe to delete along with
 * `.pgdata/` once a real Postgres instance is available. Credentials match
 * `.env.example` exactly.
 */
const fs = require('fs');
const EmbeddedPostgres = require('embedded-postgres').default;

const databaseDir = __dirname + '/../.pgdata';
const alreadyInitialised = fs.existsSync(databaseDir + '/PG_VERSION');

const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'postgres',
  password: 'postgres',
  port: 5432,
  persistent: true,
});

(async () => {
  try {
    // initdb refuses to run against a non-empty directory — only run it on
    // a genuinely fresh .pgdata (e.g. after a hard restart mid-session).
    if (!alreadyInitialised) await pg.initialise();
    await pg.start();
    try {
      await pg.createDatabase('eshop_marketplace');
    } catch (err) {
      // already exists on a restart — fine
      console.log('createDatabase note:', err.message);
    }
    console.log('PG_READY');
  } catch (err) {
    console.error('PG_FAILED', err);
    process.exit(1);
  }
})();

process.on('SIGTERM', async () => {
  await pg.stop();
  process.exit(0);
});
