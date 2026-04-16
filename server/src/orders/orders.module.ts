import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order } from '../database/entities/order.entity';
import { OrderItem } from '../database/entities/order-item.entity';
import { OrderItemModifier } from '../database/entities/order-item-modifier.entity';
import { MenuItem } from '../database/entities/menu-item.entity';
import { Modifier } from '../database/entities/modifier.entity';
import { Table } from '../database/entities/table.entity';
import { Setting } from '../database/entities/setting.entity';
import { AuthModule } from '../auth/auth.module';
import { EventBusService } from '../common/event-bus.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      OrderItemModifier,
      MenuItem,
      Modifier,
      Table,
      Setting,
    ]),
    AuthModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, EventBusService],
  exports: [OrdersService, EventBusService],
})
export class OrdersModule {}
