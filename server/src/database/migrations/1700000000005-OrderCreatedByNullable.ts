import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrderCreatedByNullable1700000000005 implements MigrationInterface {
  name = 'OrderCreatedByNullable1700000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the existing RESTRICT FK
    await queryRunner.query(`
      ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "FK_orders_created_by"
    `);
    // Find and drop by convention name if the above didn't match
    await queryRunner.query(`
      DO $$
      DECLARE r RECORD;
      BEGIN
        FOR r IN
          SELECT tc.constraint_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_name = 'orders'
            AND tc.constraint_type = 'FOREIGN KEY'
            AND kcu.column_name = 'created_by'
        LOOP
          EXECUTE 'ALTER TABLE orders DROP CONSTRAINT ' || quote_ident(r.constraint_name);
        END LOOP;
      END $$;
    `);
    // Allow NULL
    await queryRunner.query(`
      ALTER TABLE "orders" ALTER COLUMN "created_by" DROP NOT NULL
    `);
    // Re-add FK with SET NULL
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD CONSTRAINT "FK_orders_created_by"
        FOREIGN KEY ("created_by") REFERENCES "users"("id")
        ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "FK_orders_created_by"`);
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "created_by" SET NOT NULL`);
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD CONSTRAINT "FK_orders_created_by"
        FOREIGN KEY ("created_by") REFERENCES "users"("id")
        ON DELETE RESTRICT
    `);
  }
}
