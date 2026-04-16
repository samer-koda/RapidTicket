import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { Payment } from '../database/entities/payment.entity';
import { Order } from '../database/entities/order.entity';
import { OrderItem } from '../database/entities/order-item.entity';
import { Table } from '../database/entities/table.entity';
import { Setting } from '../database/entities/setting.entity';
import { AuthModule } from '../auth/auth.module';
import { EventBusService } from '../common/event-bus.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Order, OrderItem, Table, Setting]),
    AuthModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, EventBusService],
})
export class PaymentsModule {}
