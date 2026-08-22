import { MigrationInterface, QueryRunner } from 'typeorm';

/** Buyer <-> vendor real-time chat: one conversation per (buyer, store)
 * pair, messages are text or image. */
export class Chat1755310000000 implements MigrationInterface {
  name = 'Chat1755310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "conversations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "buyer_id" uuid NOT NULL,
        "store_id" uuid NOT NULL,
        "started_from_product_id" uuid,
        "last_message_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_conversation_buyer_store" UNIQUE ("buyer_id", "store_id"),
        CONSTRAINT "FK_conversations_buyer" FOREIGN KEY ("buyer_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "FK_conversations_store" FOREIGN KEY ("store_id")
          REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "FK_conversations_started_from_product" FOREIGN KEY ("started_from_product_id")
          REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_conversations_buyer_id" ON "conversations" ("buyer_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_conversations_store_id" ON "conversations" ("store_id")`);

    await queryRunner.query(`CREATE TYPE "messages_type_enum" AS ENUM ('text', 'image')`);
    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversation_id" uuid NOT NULL,
        "sender_id" uuid NOT NULL,
        "type" "messages_type_enum" NOT NULL DEFAULT 'text',
        "body" text,
        "image_url" varchar(500),
        "read_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_messages" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_message_content_matches_type" CHECK (
          ("type" = 'text' AND "body" IS NOT NULL) OR
          ("type" = 'image' AND "image_url" IS NOT NULL)
        ),
        CONSTRAINT "FK_messages_conversation" FOREIGN KEY ("conversation_id")
          REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "FK_messages_sender" FOREIGN KEY ("sender_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_messages_conversation_id" ON "messages" ("conversation_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_messages_sender_id" ON "messages" ("sender_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "messages"`);
    await queryRunner.query(`DROP TYPE "messages_type_enum"`);
    await queryRunner.query(`DROP TABLE "conversations"`);
  }
}
