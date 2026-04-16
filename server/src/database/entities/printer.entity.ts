import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

export enum KitchenPrinterType {
  KITCHEN = 'KITCHEN',
}

@Entity('printers')
export class Printer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ name: 'ip_address', type: 'text' })
  ipAddress: string;

  @Column({ type: 'int', default: 9100 })
  port: number;

  @Column({ type: 'enum', enum: KitchenPrinterType, default: KitchenPrinterType.KITCHEN })
  type: KitchenPrinterType;
}
