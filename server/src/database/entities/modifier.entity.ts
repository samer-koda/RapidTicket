import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
} from 'typeorm';
import { MenuItem } from './menu-item.entity';

export enum ModifierAction {
  ADD = 'ADD',
  REMOVE = 'REMOVE',
}

@Entity('modifiers')
export class Modifier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  label: string;

  @Column({ type: 'enum', enum: ModifierAction })
  action: ModifierAction;

  @Column({ name: 'price_delta', type: 'decimal', precision: 10, scale: 2, default: 0 })
  priceDelta: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @ManyToMany(() => MenuItem, (item) => item.modifiers)
  menuItems: MenuItem[];
}
