import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Store } from './store.entity';
import { VendorStatus } from './enums';
import { User } from './user.entity';

@Entity('vendors')
export class Vendor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (user) => user.vendor, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn()
  @Index({ unique: true })
  user: User;

  /** No `deletedAt` on Vendor — `status: suspended` IS the deactivation
   * mechanism. All history (stores, vendor orders, payouts) stays intact. */
  @Index()
  @Column({ type: 'enum', enum: VendorStatus, default: VendorStatus.PENDING })
  status: VendorStatus;

  @Column({ type: 'varchar', length: 255 })
  businessName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  taxId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  stripeAccountId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payoutDetails: Record<string, unknown> | null;

  @OneToMany(() => Store, (store) => store.vendor)
  stores: Store[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
