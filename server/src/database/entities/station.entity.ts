import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum StationPrinterType {
  USB = 'USB',
  BLUETOOTH = 'BLUETOOTH',
  NONE = 'NONE',
}

@Entity('stations')
export class Station {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ name: 'mac_address', type: 'text', unique: true })
  macAddress: string;

  @Column({ name: 'license_token', type: 'text' })
  licenseToken: string;

  @Column({
    name: 'printer_type',
    type: 'enum',
    enum: StationPrinterType,
    default: StationPrinterType.NONE,
  })
  printerType: StationPrinterType;

  @Column({ name: 'printer_name', type: 'text', nullable: true })
  printerName: string | null;

  @Column({ name: 'default_floor_plan_id', type: 'uuid', nullable: true })
  defaultFloorPlanId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
