import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MenuItem } from './menu-item.entity';

export enum ModifierAction {
  ADD = 'ADD',
  REMOVE = 'REMOVE',
}

@Entity('menu_item_modifiers')
export class MenuItemModifier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'menu_item_id', type: 'uuid' })
  menuItemId: string;

  @ManyToOne(() => MenuItem, (item) => item.modifiers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'menu_item_id' })
  menuItem: MenuItem;

  @Column({ type: 'text' })
  label: string;

  @Column({ type: 'enum', enum: ModifierAction })
  action: ModifierAction;

  @Column({ name: 'price_delta', type: 'decimal', precision: 10, scale: 2, default: 0 })
  priceDelta: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
