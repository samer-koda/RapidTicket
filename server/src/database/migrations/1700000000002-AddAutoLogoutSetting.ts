import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAutoLogoutSetting1700000000002 implements MigrationInterface {
  name = 'AddAutoLogoutSetting1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "settings" ("key", "value") VALUES
        ('auto_logout', 'true')
      ON CONFLICT ("key") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "settings" WHERE "key" = 'auto_logout'
    `);
  }
}
