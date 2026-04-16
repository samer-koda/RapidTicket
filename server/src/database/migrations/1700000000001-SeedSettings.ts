import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedSettings1700000000001 implements MigrationInterface {
  name = 'SeedSettings1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "settings" ("key", "value") VALUES
        ('tax_rate', '0.0875'),
        ('pin_lockout_threshold', '5'),
        ('pin_lockout_duration', '300'),
        ('auto_logout', 'true')
      ON CONFLICT ("key") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "settings" WHERE "key" IN ('tax_rate', 'pin_lockout_threshold', 'pin_lockout_duration', 'auto_logout')
    `);
  }
}
