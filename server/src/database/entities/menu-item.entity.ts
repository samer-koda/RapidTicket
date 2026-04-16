import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  ManyToMany,
  JoinTable,
  JoinColumn,
} from 'typeorm';
import { Category } from './category.entity';
import { Modifier } from './modifier.entity';

export enum MenuItemType {
  FOOD = 'FOOD',
  DRINK = 'DRINK',
}

export enum PrintDestination {
  KITCHEN = 'KITCHEN',
  BAR = 'BAR',
  NONE = 'NONE',
}

@Entity('menu_items')
export class MenuItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => Category, (cat) => cat.items, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'enum', enum: MenuItemType })
  type: MenuItemType;

  @Column({ name: 'is_taxable', type: 'boolean', default: true })
  isTaxable: boolean;

  @Column({
    name: 'print_destination',
    type: 'enum',
    enum: PrintDestination,
    default: PrintDestination.NONE,
  })
  printDestination: PrintDestination;

  @Column({ name: 'is_available', type: 'boolean', default: true })
  isAvailable: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @ManyToMany(() => Modifier, (mod) => mod.menuItems, { eager: false })
  @JoinTable({
    name: 'menu_item_modifier_links',
    joinColumn: { name: 'menu_item_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'modifier_id', referencedColumnName: 'id' },
  })
  modifiers: Modifier[];
}
