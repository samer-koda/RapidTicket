import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { FloorPlan } from './entities/floor-plan.entity';
import { Table } from './entities/table.entity';
import { Seat } from './entities/seat.entity';
import { Category } from './entities/category.entity';
import { MenuItem } from './entities/menu-item.entity';
import { Modifier } from './entities/modifier.entity';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderItemModifier } from './entities/order-item-modifier.entity';
import { Payment } from './entities/payment.entity';
import { Setting } from './entities/setting.entity';
import { Station } from './entities/station.entity';
import { Printer } from './entities/printer.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'rapidticket',
  password: process.env.DB_PASSWORD ?? 'rapidticket',
  database: process.env.DB_DATABASE ?? 'rapidticket',
  synchronize: false,
  migrationsRun: true,
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
  migrations: ['src/database/migrations/*.ts'],
});
