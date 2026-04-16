import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Printer } from '../database/entities/printer.entity';
import { PrintService } from './print.service';

@Module({
  imports: [TypeOrmModule.forFeature([Printer])],
  providers: [PrintService],
  exports: [PrintService],
})
export class PrintModule {}
