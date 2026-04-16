import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FloorPlansService } from './floor-plans.service';
import { FloorPlansController } from './floor-plans.controller';
import { FloorPlan } from '../database/entities/floor-plan.entity';
import { Table } from '../database/entities/table.entity';
import { Seat } from '../database/entities/seat.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FloorPlan, Table, Seat]),
    AuthModule,
  ],
  controllers: [FloorPlansController],
  providers: [FloorPlansService],
  exports: [FloorPlansService],
})
export class FloorPlansModule {}
