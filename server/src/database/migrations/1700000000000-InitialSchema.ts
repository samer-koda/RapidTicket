import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable uuid-ossp extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Enums
    await queryRunner.query(`CREATE TYPE "user_role_enum" AS ENUM ('admin', 'server', 'bartender')`);
    await queryRunner.query(`CREATE TYPE "table_shape_enum" AS ENUM ('ROUND', 'RECTANGLE')`);
    await queryRunner.query(`CREATE TYPE "table_status_enum" AS ENUM ('OPEN', 'CLOSED')`);
    await queryRunner.query(`CREATE TYPE "menu_item_type_enum" AS ENUM ('FOOD', 'DRINK')`);
    await queryRunner.query(`CREATE TYPE "print_destination_enum" AS ENUM ('KITCHEN', 'BAR', 'NONE')`);
    await queryRunner.query(`CREATE TYPE "modifier_action_enum" AS ENUM ('ADD', 'REMOVE')`);
    await queryRunner.query(`CREATE TYPE "order_status_enum" AS ENUM ('OPEN', 'SENT', 'READY', 'CLOSED')`);
    await queryRunner.query(`CREATE TYPE "order_item_status_enum" AS ENUM ('NEW', 'SENT', 'PREPARING', 'READY')`);
    await queryRunner.query(`CREATE TYPE "payment_method_enum" AS ENUM ('CASH', 'CARD_EXTERNAL')`);
    await queryRunner.query(`CREATE TYPE "payment_status_enum" AS ENUM ('PENDING', 'COMPLETED')`);
    await queryRunner.query(`CREATE TYPE "station_printer_type_enum" AS ENUM ('USB', 'BLUETOOTH', 'NONE')`);
    await queryRunner.query(`CREATE TYPE "kitchen_printer_type_enum" AS ENUM ('KITCHEN')`);

    // users
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name"       TEXT NOT NULL,
        "role"       "user_role_enum" NOT NULL,
        "pin_hash"   TEXT NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // floor_plans
    await queryRunner.query(`
      CREATE TABLE "floor_plans" (
        "id"         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name"       TEXT NOT NULL,
        "sort_order" INT NOT NULL DEFAULT 0
      )
    `);

    // tables
    await queryRunner.query(`
      CREATE TABLE "tables" (
        "id"            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "floor_plan_id" UUID NOT NULL REFERENCES "floor_plans"("id") ON DELETE RESTRICT,
        "name"          TEXT NOT NULL,
        "shape"         "table_shape_enum" NOT NULL,
        "position_x"    INT NOT NULL DEFAULT 0,
        "position_y"    INT NOT NULL DEFAULT 0,
        "status"        "table_status_enum" NOT NULL DEFAULT 'OPEN',
        "occupied"      BOOLEAN NOT NULL DEFAULT false
      )
    `);

    // seats
    await queryRunner.query(`
      CREATE TABLE "seats" (
        "id"       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "table_id" UUID NOT NULL REFERENCES "tables"("id") ON DELETE CASCADE,
        "label"    TEXT NOT NULL
      )
    `);

    // categories
    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id"         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name"       TEXT NOT NULL,
        "sort_order" INT NOT NULL DEFAULT 0
      )
    `);

    // menu_items
    await queryRunner.query(`
      CREATE TABLE "menu_items" (
        "id"                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name"              TEXT NOT NULL,
        "category_id"       UUID NOT NULL REFERENCES "categories"("id") ON DELETE RESTRICT,
        "price"             DECIMAL(10,2) NOT NULL,
        "type"              "menu_item_type_enum" NOT NULL,
        "is_taxable"        BOOLEAN NOT NULL DEFAULT true,
        "print_destination" "print_destination_enum" NOT NULL DEFAULT 'NONE',
        "is_available"      BOOLEAN NOT NULL DEFAULT true,
        "sort_order"        INT NOT NULL DEFAULT 0
      )
    `);

    // menu_item_modifiers
    await queryRunner.query(`
      CREATE TABLE "menu_item_modifiers" (
        "id"           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "menu_item_id" UUID NOT NULL REFERENCES "menu_items"("id") ON DELETE CASCADE,
        "label"        TEXT NOT NULL,
        "action"       "modifier_action_enum" NOT NULL,
        "price_delta"  DECIMAL(10,2) NOT NULL DEFAULT 0,
        "sort_order"   INT NOT NULL DEFAULT 0
      )
    `);

    // orders
    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id"               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "table_id"         UUID NOT NULL REFERENCES "tables"("id") ON DELETE RESTRICT,
        "created_by"       UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "status"           "order_status_enum" NOT NULL DEFAULT 'OPEN',
        "subtotal"         DECIMAL(10,2) NOT NULL DEFAULT 0,
        "taxable_subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
        "tax_amount"       DECIMAL(10,2) NOT NULL DEFAULT 0,
        "total"            DECIMAL(10,2) NOT NULL DEFAULT 0,
        "created_at"       TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // order_items
    await queryRunner.query(`
      CREATE TABLE "order_items" (
        "id"                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "order_id"          UUID NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
        "menu_item_id"      UUID NOT NULL REFERENCES "menu_items"("id") ON DELETE RESTRICT,
        "quantity"          INT NOT NULL DEFAULT 1,
        "unit_price"        DECIMAL(10,2) NOT NULL,
        "is_taxable"        BOOLEAN NOT NULL,
        "print_destination" "print_destination_enum" NOT NULL,
        "notes"             TEXT,
        "status"            "order_item_status_enum" NOT NULL DEFAULT 'NEW'
      )
    `);

    // order_item_modifiers
    await queryRunner.query(`
      CREATE TABLE "order_item_modifiers" (
        "id"            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "order_item_id" UUID NOT NULL REFERENCES "order_items"("id") ON DELETE CASCADE,
        "modifier_id"   UUID NOT NULL,
        "label"         TEXT NOT NULL,
        "action"        "modifier_action_enum" NOT NULL,
        "price_delta"   DECIMAL(10,2) NOT NULL DEFAULT 0
      )
    `);

    // payments
    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id"               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "order_id"         UUID NOT NULL REFERENCES "orders"("id") ON DELETE RESTRICT,
        "subtotal"         DECIMAL(10,2) NOT NULL,
        "taxable_subtotal" DECIMAL(10,2) NOT NULL,
        "tax_rate"         DECIMAL(5,4) NOT NULL,
        "tax_amount"       DECIMAL(10,2) NOT NULL,
        "tip_amount"       DECIMAL(10,2) NOT NULL DEFAULT 0,
        "total"            DECIMAL(10,2) NOT NULL,
        "method"           "payment_method_enum" NOT NULL,
        "status"           "payment_status_enum" NOT NULL DEFAULT 'PENDING',
        "created_at"       TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // settings
    await queryRunner.query(`
      CREATE TABLE "settings" (
        "key"        TEXT PRIMARY KEY,
        "value"      TEXT NOT NULL,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // stations
    await queryRunner.query(`
      CREATE TABLE "stations" (
        "id"            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name"          TEXT NOT NULL,
        "mac_address"   TEXT NOT NULL UNIQUE,
        "license_token" TEXT NOT NULL,
        "printer_type"  "station_printer_type_enum" NOT NULL DEFAULT 'NONE',
        "printer_name"  TEXT,
        "created_at"    TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // printers
    await queryRunner.query(`
      CREATE TABLE "printers" (
        "id"         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name"       TEXT NOT NULL,
        "ip_address" TEXT NOT NULL,
        "port"       INT NOT NULL DEFAULT 9100,
        "type"       "kitchen_printer_type_enum" NOT NULL DEFAULT 'KITCHEN'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "printers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "settings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "order_item_modifiers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "order_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "menu_item_modifiers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "menu_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "categories"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "seats"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tables"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "floor_plans"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "kitchen_printer_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "station_printer_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payment_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payment_method_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "order_item_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "order_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "modifier_action_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "print_destination_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "menu_item_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "table_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "table_shape_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_role_enum"`);
  }
}
