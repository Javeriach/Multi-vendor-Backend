import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the commerce layer on top of the Phase 2 foundation: carts,
 * wishlists, the Order/VendorOrder/OrderItem aggregate, payments, and
 * reviews — plus the Store/Product columns the marketplace build-out needs
 * (Store.status replacing the earlier isActive flag, Product rating
 * aggregates). Additive migration; the InitialSchema migration is left
 * untouched.
 */
export class CommerceCore1755290000000 implements MigrationInterface {
  name = 'CommerceCore1755290000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------ stores: status
    await queryRunner.query(
      `CREATE TYPE "stores_status_enum" AS ENUM ('pending', 'active', 'suspended', 'rejected')`,
    );
    await queryRunner.query(`
      ALTER TABLE "stores"
        ADD COLUMN "banner_url" varchar(500),
        ADD COLUMN "contact_email" varchar(255),
        ADD COLUMN "contact_phone" varchar(30),
        ADD COLUMN "status" "stores_status_enum" NOT NULL DEFAULT 'pending'
    `);
    await queryRunner.query(`
      UPDATE "stores" SET "status" = CASE WHEN "is_active" THEN 'active' ELSE 'suspended' END::"stores_status_enum"
    `);
    await queryRunner.query(`CREATE INDEX "IDX_stores_status" ON "stores" ("status")`);
    await queryRunner.query(`ALTER TABLE "stores" DROP COLUMN "is_active"`);

    // ----------------------------------------------------- products: rating
    await queryRunner.query(`
      ALTER TABLE "products"
        ADD COLUMN "rating_average" numeric(3,2) NOT NULL DEFAULT 0,
        ADD COLUMN "review_count" integer NOT NULL DEFAULT 0
    `);

    // --------------------------------------------------------------- carts
    await queryRunner.query(`
      CREATE TABLE "carts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_carts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_carts_user_id" UNIQUE ("user_id"),
        CONSTRAINT "FK_carts_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    // ---------------------------------------------------------- cart_items
    await queryRunner.query(`
      CREATE TABLE "cart_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "cart_id" uuid NOT NULL,
        "variant_id" uuid NOT NULL,
        "quantity" integer NOT NULL,
        "selected_for_purchase" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cart_items" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_cart_item_cart_variant" UNIQUE ("cart_id", "variant_id"),
        CONSTRAINT "CHK_cart_item_quantity_positive" CHECK ("quantity" > 0),
        CONSTRAINT "FK_cart_items_cart" FOREIGN KEY ("cart_id")
          REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "FK_cart_items_variant" FOREIGN KEY ("variant_id")
          REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_cart_items_cart_id" ON "cart_items" ("cart_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_cart_items_variant_id" ON "cart_items" ("variant_id")`);

    // ----------------------------------------------------------- wishlists
    await queryRunner.query(`
      CREATE TABLE "wishlists" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_wishlists" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_wishlists_user_id" UNIQUE ("user_id"),
        CONSTRAINT "FK_wishlists_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    // ------------------------------------------------------ wishlist_items
    await queryRunner.query(`
      CREATE TABLE "wishlist_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "wishlist_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_wishlist_items" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_wishlist_item_wishlist_product" UNIQUE ("wishlist_id", "product_id"),
        CONSTRAINT "FK_wishlist_items_wishlist" FOREIGN KEY ("wishlist_id")
          REFERENCES "wishlists"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "FK_wishlist_items_product" FOREIGN KEY ("product_id")
          REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_wishlist_items_wishlist_id" ON "wishlist_items" ("wishlist_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_wishlist_items_product_id" ON "wishlist_items" ("product_id")`);

    // --------------------------------------------------------------- orders
    await queryRunner.query(
      `CREATE TYPE "orders_status_enum" AS ENUM ('pending', 'confirmed', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "orders_payment_status_enum" AS ENUM ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')`,
    );
    await queryRunner.query(
      `CREATE TYPE "orders_payment_method_enum" AS ENUM ('card', 'cash_on_delivery')`,
    );
    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "order_number" varchar(32) NOT NULL,
        "user_id" uuid NOT NULL,
        "shipping_address_id" uuid,
        "shipping_name" varchar(255) NOT NULL,
        "shipping_phone" varchar(30) NOT NULL,
        "shipping_street_address" varchar(255) NOT NULL,
        "shipping_city" varchar(100) NOT NULL,
        "shipping_area" varchar(100) NOT NULL,
        "shipping_country" varchar(100) NOT NULL,
        "shipping_postal_code" varchar(20) NOT NULL,
        "status" "orders_status_enum" NOT NULL DEFAULT 'pending',
        "payment_status" "orders_payment_status_enum" NOT NULL DEFAULT 'pending',
        "payment_method" "orders_payment_method_enum" NOT NULL,
        "subtotal" numeric(12,2) NOT NULL,
        "shipping_total" numeric(12,2) NOT NULL DEFAULT 0,
        "tax_total" numeric(12,2) NOT NULL DEFAULT 0,
        "discount_total" numeric(12,2) NOT NULL DEFAULT 0,
        "total" numeric(12,2) NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'USD',
        "stripe_session_id" varchar(255),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_orders" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_orders_order_number" UNIQUE ("order_number"),
        CONSTRAINT "UQ_orders_stripe_session_id" UNIQUE ("stripe_session_id"),
        CONSTRAINT "FK_orders_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "FK_orders_shipping_address" FOREIGN KEY ("shipping_address_id")
          REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_orders_user_id" ON "orders" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_orders_status" ON "orders" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_orders_payment_status" ON "orders" ("payment_status")`);
    await queryRunner.query(`CREATE INDEX "IDX_orders_created_at" ON "orders" ("created_at")`);

    // ---------------------------------------------------------- vendor_orders
    await queryRunner.query(
      `CREATE TYPE "vendor_orders_status_enum" AS ENUM ('processing', 'shipped', 'delivered', 'cancelled')`,
    );
    await queryRunner.query(`
      CREATE TABLE "vendor_orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "order_id" uuid NOT NULL,
        "store_id" uuid NOT NULL,
        "status" "vendor_orders_status_enum" NOT NULL DEFAULT 'processing',
        "subtotal" numeric(12,2) NOT NULL,
        "shipping_fee" numeric(12,2) NOT NULL DEFAULT 0,
        "commission_rate_snapshot" numeric(12,2) NOT NULL DEFAULT 0,
        "commission_amount" numeric(12,2) NOT NULL DEFAULT 0,
        "total" numeric(12,2) NOT NULL,
        "tracking_number" varchar(255),
        "tracking_carrier" varchar(255),
        "shipped_at" timestamptz,
        "delivered_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vendor_orders" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_vendor_order_order_store" UNIQUE ("order_id", "store_id"),
        CONSTRAINT "FK_vendor_orders_order" FOREIGN KEY ("order_id")
          REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "FK_vendor_orders_store" FOREIGN KEY ("store_id")
          REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_vendor_orders_order_id" ON "vendor_orders" ("order_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_vendor_orders_store_id" ON "vendor_orders" ("store_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_vendor_orders_status" ON "vendor_orders" ("status")`);

    // ------------------------------------------------------------ order_items
    await queryRunner.query(`
      CREATE TABLE "order_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "vendor_order_id" uuid NOT NULL,
        "variant_id" uuid,
        "quantity" integer NOT NULL,
        "unit_price" numeric(12,2) NOT NULL,
        "total" numeric(12,2) NOT NULL,
        "product_name_snapshot" varchar(255) NOT NULL,
        "sku_snapshot" varchar(100) NOT NULL,
        "variant_attributes_snapshot" jsonb,
        "image_url_snapshot" varchar(500),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_items" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_order_item_quantity_positive" CHECK ("quantity" > 0),
        CONSTRAINT "CHK_order_item_unit_price_non_negative" CHECK ("unit_price" >= 0),
        CONSTRAINT "FK_order_items_vendor_order" FOREIGN KEY ("vendor_order_id")
          REFERENCES "vendor_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "FK_order_items_variant" FOREIGN KEY ("variant_id")
          REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_order_items_vendor_order_id" ON "order_items" ("vendor_order_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_order_items_variant_id" ON "order_items" ("variant_id")`);

    // -------------------------------------------------------------- payments
    await queryRunner.query(`CREATE TYPE "payments_type_enum" AS ENUM ('charge', 'refund')`);
    await queryRunner.query(
      `CREATE TYPE "payments_status_enum" AS ENUM ('pending', 'succeeded', 'failed')`,
    );
    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "order_id" uuid NOT NULL,
        "type" "payments_type_enum" NOT NULL,
        "parent_payment_id" uuid,
        "provider" varchar(50) NOT NULL,
        "provider_ref" varchar(255) NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'USD',
        "status" "payments_status_enum" NOT NULL DEFAULT 'pending',
        "failure_reason" text,
        "succeeded_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payments" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_payment_provider_ref" UNIQUE ("provider", "provider_ref"),
        CONSTRAINT "CHK_payment_refund_has_parent" CHECK (
          ("type" = 'refund' AND "parent_payment_id" IS NOT NULL) OR
          ("type" = 'charge' AND "parent_payment_id" IS NULL)
        ),
        CONSTRAINT "FK_payments_order" FOREIGN KEY ("order_id")
          REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "FK_payments_parent_payment" FOREIGN KEY ("parent_payment_id")
          REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_payments_order_id" ON "payments" ("order_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_payments_type" ON "payments" ("type")`);
    await queryRunner.query(`CREATE INDEX "IDX_payments_status" ON "payments" ("status")`);

    // -------------------------------------------------------------- reviews
    await queryRunner.query(`
      CREATE TABLE "reviews" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "order_item_id" uuid NOT NULL,
        "rating" smallint NOT NULL,
        "title" varchar(255),
        "comment" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_reviews" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_review_user_product" UNIQUE ("user_id", "product_id"),
        CONSTRAINT "CHK_review_rating_range" CHECK ("rating" BETWEEN 1 AND 5),
        CONSTRAINT "FK_reviews_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "FK_reviews_product" FOREIGN KEY ("product_id")
          REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "FK_reviews_order_item" FOREIGN KEY ("order_item_id")
          REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_reviews_product_id" ON "reviews" ("product_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_reviews_user_id" ON "reviews" ("user_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "reviews"`);
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TYPE "payments_status_enum"`);
    await queryRunner.query(`DROP TYPE "payments_type_enum"`);
    await queryRunner.query(`DROP TABLE "order_items"`);
    await queryRunner.query(`DROP TABLE "vendor_orders"`);
    await queryRunner.query(`DROP TYPE "vendor_orders_status_enum"`);
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP TYPE "orders_payment_method_enum"`);
    await queryRunner.query(`DROP TYPE "orders_payment_status_enum"`);
    await queryRunner.query(`DROP TYPE "orders_status_enum"`);
    await queryRunner.query(`DROP TABLE "wishlist_items"`);
    await queryRunner.query(`DROP TABLE "wishlists"`);
    await queryRunner.query(`DROP TABLE "cart_items"`);
    await queryRunner.query(`DROP TABLE "carts"`);

    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "review_count"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "rating_average"`);

    await queryRunner.query(`ALTER TABLE "stores" ADD COLUMN "is_active" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(
      `UPDATE "stores" SET "is_active" = ("status" = 'active')`,
    );
    await queryRunner.query(`DROP INDEX "IDX_stores_status"`);
    await queryRunner.query(`ALTER TABLE "stores" DROP COLUMN "status"`);
    await queryRunner.query(`ALTER TABLE "stores" DROP COLUMN "contact_phone"`);
    await queryRunner.query(`ALTER TABLE "stores" DROP COLUMN "contact_email"`);
    await queryRunner.query(`ALTER TABLE "stores" DROP COLUMN "banner_url"`);
    await queryRunner.query(`DROP TYPE "stores_status_enum"`);
  }
}
