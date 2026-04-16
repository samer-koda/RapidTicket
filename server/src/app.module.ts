import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { User } from './database/entities/user.entity';
import { FloorPlan } from './database/entities/floor-plan.entity';
import { Table } from './database/entities/table.entity';
import { Seat } from './database/entities/seat.entity';
import { Category } from './database/entities/category.entity';
import { MenuItem } from './database/entities/menu-item.entity';
import { Modifier } from './database/entities/modifier.entity';
import { Order } from './database/entities/order.entity';
import { OrderItem } from './database/entities/order-item.entity';
import { OrderItemModifier } from './database/entities/order-item-modifier.entity';
import { Payment } from './database/entities/payment.entity';
import { Setting } from './database/entities/setting.entity';
import { Station } from './database/entities/station.entity';
import { Printer } from './database/entities/printer.entity';
import { AuthModule } from './auth/auth.module';
import { MenuModule } from './menu/menu.module';
import { FloorPlansModule } from './floor-plans/floor-plans.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { SettingsModule } from './settings/settings.module';
import { StationsModule } from './stations/stations.module';
import { PrintersModule } from './printers/printers.module';
import { ReportsModule } from './reports/reports.module';
import { GatewayModule } from './gateway/gateway.module';
import { PrintModule } from './print/print.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USERNAME', 'rapidticket'),
        password: config.get<string>('DB_PASSWORD', 'rapidticket'),
        database: config.get<string>('DB_DATABASE', 'rapidticket'),
        synchronize: false,
        migrationsRun: true,
        migrationsTableName: 'typeorm_migrations',
        entities: [
          User,
          FloorPlan,
          Table,
          Seat,
          Category,
          MenuItem,
          Modifier,
          Order,
          OrderItem,
          OrderItemModifier,
          Payment,
          Setting,
          Station,
          Printer,
        ],
        migrations: [__dirname + '/database/migrations/*.{ts,js}'],
      }),
    }),

    AuthModule,
    MenuModule,
    FloorPlansModule,
    OrdersModule,
    PaymentsModule,
    SettingsModule,
    StationsModule,
    PrintersModule,
    ReportsModule,
    GatewayModule,
    PrintModule,
    UsersModule,
  ],
})
export class AppModule {}

