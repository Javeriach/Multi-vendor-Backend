import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { entities } from '../entities';
import { getPostgresConnectionOptions } from './postgres-connection-options';

config();

/**
 * Standalone DataSource for the TypeORM CLI (migration:generate/run/revert).
 * Nest's DI container isn't available outside a running app, so this
 * duplicates the connection shape from app.module.ts — but imports the same
 * `entities` array (and the same connection-options helper) so the two can
 * never list different entities, or connect differently, by mistake.
 */
export const dataSourceOptions: DataSourceOptions = {
  ...getPostgresConnectionOptions((key) => process.env[key]),
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  entities,
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
