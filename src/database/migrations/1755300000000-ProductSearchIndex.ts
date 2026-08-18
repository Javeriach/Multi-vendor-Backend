import { MigrationInterface, QueryRunner } from 'typeorm';

/** Trigram GIN index so `ILIKE '%term%'` search on product name/description
 * (ProductsService.search) can actually use an index instead of a full
 * sequential scan once the catalog grows past a trivial size. */
export class ProductSearchIndex1755300000000 implements MigrationInterface {
  name = 'ProductSearchIndex1755300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_products_name_trgm" ON "products" USING GIN ("name" gin_trgm_ops)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_products_name_trgm"`);
  }
}
