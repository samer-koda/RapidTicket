import { MigrationInterface, QueryRunner } from 'typeorm';

export class GlobalModifierLibrary1700000000004 implements MigrationInterface {
  name = 'GlobalModifierLibrary1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create the global modifiers library table
    await queryRunner.query(`
      CREATE TABLE "modifiers" (
        "id"          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "label"       TEXT NOT NULL,
        "action"      "modifier_action_enum" NOT NULL,
        "price_delta" DECIMAL(10,2) NOT NULL DEFAULT 0,
        "sort_order"  INT NOT NULL DEFAULT 0
      )
    `);

    // 2. Create the many-to-many join table
    await queryRunner.query(`
      CREATE TABLE "menu_item_modifier_links" (
        "menu_item_id" UUID NOT NULL REFERENCES "menu_items"("id") ON DELETE CASCADE,
        "modifier_id"  UUID NOT NULL REFERENCES "modifiers"("id") ON DELETE CASCADE,
        PRIMARY KEY ("menu_item_id", "modifier_id")
      )
    `);

    // 3. Migrate existing per-item modifiers into the global library.
    //    Deduplicate by (label, action, price_delta) — same combo becomes one global modifier.
    await queryRunner.query(`
      INSERT INTO "modifiers" ("label", "action", "price_delta", "sort_order")
      SELECT DISTINCT ON (label, action, price_delta)
        label, action, price_delta, sort_order
      FROM "menu_item_modifiers"
      ORDER BY label, action, price_delta, sort_order
    `);

    // 4. Build the join table links by matching on (label, action, price_delta).
    await queryRunner.query(`
      INSERT INTO "menu_item_modifier_links" ("menu_item_id", "modifier_id")
      SELECT mim.menu_item_id, m.id
      FROM "menu_item_modifiers" mim
      JOIN "modifiers" m
        ON m.label = mim.label
       AND m.action = mim.action
       AND m.price_delta = mim.price_delta
      ON CONFLICT DO NOTHING
    `);

    // 5. Drop the old per-item modifiers table
    await queryRunner.query(`DROP TABLE "menu_item_modifiers"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-create the old table and restore data from the join + global table
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

    await queryRunner.query(`
      INSERT INTO "menu_item_modifiers" ("menu_item_id", "label", "action", "price_delta", "sort_order")
      SELECT l.menu_item_id, m.label, m.action, m.price_delta, m.sort_order
      FROM "menu_item_modifier_links" l
      JOIN "modifiers" m ON m.id = l.modifier_id
    `);

    await queryRunner.query(`DROP TABLE "menu_item_modifier_links"`);
    await queryRunner.query(`DROP TABLE "modifiers"`);
  }
}
