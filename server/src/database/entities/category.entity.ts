import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { MenuItem } from './menu-item.entity';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ type: 'bytea', nullable: true, select: false })
  image!: Buffer | null;

  @Column({ name: 'image_mime_type', type: 'varchar', length: 64, nullable: true, select: false })
  imageMimeType!: string | null;

  @OneToMany(() => MenuItem, (item) => item.category)
  items!: MenuItem[];
}
