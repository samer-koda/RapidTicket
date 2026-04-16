import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAutoLogoutTimeout1700000000003 implements MigrationInterface {
  name = 'AddAutoLogoutTimeout1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "settings" ("key", "value") VALUES
        ('auto_logout_timeout', '120')
      ON CONFLICT ("key") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "settings" WHERE "key" = 'auto_logout_timeout'
    `);
  }
}
