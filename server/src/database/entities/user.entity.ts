import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum UserRole {
  ADMIN = 'admin',
  SERVER = 'server',
  BARTENDER = 'bartender',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column({ name: 'pin_hash', type: 'text' })
  pinHash: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
