import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

type ConnectionFields = Pick<
  PostgresConnectionOptions,
  'type' | 'url' | 'host' | 'port' | 'username' | 'password' | 'database' | 'ssl'
>;

/**
 * Shared by app.module.ts (Nest DI) and data-source.ts (TypeORM CLI) so the
 * two can never define the connection differently by mistake.
 *
 * Supports two shapes because local dev and most managed Postgres hosts
 * (Render, Neon, etc.) use different conventions:
 *  - DATABASE_URL: a single connection string (what Neon/Render provide).
 *    Neon requires TLS but its cert isn't always in Node's default trust
 *    store, hence rejectUnauthorized: false — acceptable here since we're
 *    still authenticating with a secret in the URL itself, and this is a
 *    portfolio deployment, not one handling sensitive regulated data.
 *  - discrete DATABASE_HOST/PORT/USERNAME/PASSWORD/NAME: local dev default.
 */
export function getPostgresConnectionOptions(env: (key: string) => string | undefined): ConnectionFields {
  const databaseUrl = env('DATABASE_URL');

  if (databaseUrl) {
    return {
      type: 'postgres',
      url: databaseUrl,
      ssl: { rejectUnauthorized: false },
    };
  }

  return {
    type: 'postgres',
    host: env('DATABASE_HOST'),
    port: Number(env('DATABASE_PORT') ?? 5432),
    username: env('DATABASE_USERNAME'),
    password: env('DATABASE_PASSWORD'),
    database: env('DATABASE_NAME'),
  };
}
