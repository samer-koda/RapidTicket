import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { MenuItem } from './menu-item.entity';
import { PrintDestination } from './menu-item.entity';
import { OrderItemModifier } from './order-item-modifier.entity';

export enum OrderItemStatus {
  NEW = 'NEW',
  SENT = 'SENT',
  PREPARING = 'PREPARING',
  READY = 'READY',
}

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'menu_item_id', type: 'uuid' })
  menuItemId: string;

  @ManyToOne(() => MenuItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'menu_item_id' })
  menuItem: MenuItem;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ name: 'is_taxable', type: 'boolean' })
  isTaxable: boolean;

  @Column({
    name: 'print_destination',
    type: 'enum',
    enum: PrintDestination,
  })
  printDestination: PrintDestination;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'enum', enum: OrderItemStatus, default: OrderItemStatus.NEW })
  status: OrderItemStatus;

  @OneToMany(() => OrderItemModifier, (mod) => mod.orderItem, { cascade: true })
  appliedModifiers: OrderItemModifier[];
}
