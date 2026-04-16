import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { FloorPlan } from './floor-plan.entity';
import { Seat } from './seat.entity';

export enum TableShape {
  ROUND = 'ROUND',
  RECTANGLE = 'RECTANGLE',
}

export enum TableStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

@Entity('tables')
export class Table {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'floor_plan_id', type: 'uuid' })
  floorPlanId: string;

  @ManyToOne(() => FloorPlan, (fp) => fp.tables, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'floor_plan_id' })
  floorPlan: FloorPlan;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'enum', enum: TableShape })
  shape: TableShape;

  @Column({ name: 'position_x', type: 'int', default: 0 })
  positionX: number;

  @Column({ name: 'position_y', type: 'int', default: 0 })
  positionY: number;

  @Column({ type: 'enum', enum: TableStatus, default: TableStatus.OPEN })
  status: TableStatus;

  @Column({ type: 'boolean', default: false })
  occupied: boolean;

  @OneToMany(() => Seat, (seat) => seat.table, { cascade: true })
  seats: Seat[];
}
