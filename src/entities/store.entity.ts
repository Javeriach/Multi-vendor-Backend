import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StoreStatus } from './enums';
import { Product } from './product.entity';
import { Vendor } from './vendor.entity';

@Entity('stores')
export class Store {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Deliberately NOT unique — a vendor owning multiple stores is a schema
   * change nobody should need later; v1 enforces "one store per vendor" as a
   * service-layer rule, not a DB constraint. */
  @ManyToOne(() => Vendor, (vendor) => vendor.stores, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn()
  @Index()
  vendor: Vendor;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logoUrl: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  bannerUrl: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contactEmail: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  contactPhone: string | null;

  @Index()
  @Column({ type: 'enum', enum: StoreStatus, default: StoreStatus.PENDING })
  status: StoreStatus;

  @OneToMany(() => Product, (product) => product.store)
  products: Product[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  /** Soft delete — Products depend on this row surviving for historical
   * integrity; a vendor "closing" a store never hard-deletes it. */
  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
