import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStationDefaultFloor1700000000003 implements MigrationInterface {
  name = 'AddStationDefaultFloor1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "stations"
      ADD COLUMN IF NOT EXISTS "default_floor_plan_id" uuid NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "stations" DROP COLUMN IF EXISTS "default_floor_plan_id"
    `);
  }
}
