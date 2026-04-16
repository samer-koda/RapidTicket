import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { OrderItem } from './order-item.entity';
import { ModifierAction } from './menu-item-modifier.entity';

@Entity('order_item_modifiers')
export class OrderItemModifier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_item_id', type: 'uuid' })
  orderItemId: string;

  @ManyToOne(() => OrderItem, (item) => item.appliedModifiers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_item_id' })
  orderItem: OrderItem;

  @Column({ name: 'modifier_id', type: 'uuid' })
  modifierId: string;

  @Column({ type: 'text' })
  label: string;

  @Column({ type: 'enum', enum: ModifierAction })
  action: ModifierAction;

  @Column({ name: 'price_delta', type: 'decimal', precision: 10, scale: 2, default: 0 })
  priceDelta: number;
}
