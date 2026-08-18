import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Address } from './address.entity';
import { Cart } from './cart.entity';
import { UserRole } from './enums';
import { Order } from './order.entity';
import { Review } from './review.entity';
import { Vendor } from './vendor.entity';
import { Wishlist } from './wishlist.entity';

/**
 * `role` is a coarse platform-access flag only (customer vs admin vs vendor
 * "account type" for quick guard checks). It is NOT the authoritative source
 * of vendor privileges — that is `Vendor.status === 'approved'`. See the
 * Phase 2 report for why both exist and how they're kept from drifting.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  /** Excluded from every serialized response app-wide via the global
   * ClassSerializerInterceptor (see main.ts) — no controller has to
   * remember to strip this manually. */
  @Exclude()
  @Column({ type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  photoUrl: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CUSTOMER })
  role: UserRole;

  @OneToOne(() => Vendor, (vendor) => vendor.user)
  vendor?: Vendor;

  @OneToMany(() => Address, (address) => address.user)
  addresses: Address[];

  /** Inverse sides only — no @JoinColumn here, the owning FK lives on the
   * child entity in every case (see cart.entity.ts, order.entity.ts, etc). */
  @OneToOne(() => Cart, (cart) => cart.user)
  cart?: Cart;

  @OneToOne(() => Wishlist, (wishlist) => wishlist.user)
  wishlist?: Wishlist;

  @OneToMany(() => Order, (order) => order.user)
  orders?: Order[];

  @OneToMany(() => Review, (review) => review.user)
  reviews?: Review[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  /** Soft delete only. Users are never hard-deleted while they may be
   * referenced by future order history — anonymize instead in a later phase. */
  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
