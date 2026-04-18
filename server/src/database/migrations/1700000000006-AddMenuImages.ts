import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMenuImages1700000000006 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE menu_items
        ADD COLUMN IF NOT EXISTS image bytea,
        ADD COLUMN IF NOT EXISTS image_mime_type varchar(64)
    `);
    await queryRunner.query(`
      ALTER TABLE categories
        ADD COLUMN IF NOT EXISTS image bytea,
        ADD COLUMN IF NOT EXISTS image_mime_type varchar(64)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE menu_items
        DROP COLUMN IF EXISTS image,
        DROP COLUMN IF EXISTS image_mime_type
    `);
    await queryRunner.query(`
      ALTER TABLE categories
        DROP COLUMN IF EXISTS image,
        DROP COLUMN IF EXISTS image_mime_type
    `);
  }
}
