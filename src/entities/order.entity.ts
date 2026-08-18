import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Address } from './address.entity';
import { OrderPaymentStatus, OrderStatus, PaymentMethod } from './enums';
import { Payment } from './payment.entity';
import { User } from './user.entity';
import { VendorOrder } from './vendor-order.entity';

/**
 * The parent aggregate for one checkout. Never hard-deleted — cancellation
 * is a status transition, not a row deletion (see OrderStatus.CANCELLED).
 * Shipping address is SNAPSHOTTED here (flattened columns) rather than only
 * referencing the live Address row, so an order stays fully displayable even
 * if the customer edits or deletes that address later. `shippingAddress` is
 * kept only as an optional convenience link back for "reorder" flows.
 */
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Short human-readable reference (e.g. ORD-2026-000481), distinct from
   * the UUID id — customers and support reference orders by this, not a UUID. */
  @Column({ type: 'varchar', length: 32, unique: true })
  orderNumber: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn()
  @Index()
  user: User;

  @ManyToOne(() => Address, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  shippingAddress: Address | null;

  @Column({ type: 'varchar', length: 255 })
  shippingName: string;

  @Column({ type: 'varchar', length: 30 })
  shippingPhone: string;

  @Column({ type: 'varchar', length: 255 })
  shippingStreetAddress: string;

  @Column({ type: 'varchar', length: 100 })
  shippingCity: string;

  @Column({ type: 'varchar', length: 100 })
  shippingArea: string;

  @Column({ type: 'varchar', length: 100 })
  shippingCountry: string;

  @Column({ type: 'varchar', length: 20 })
  shippingPostalCode: string;

  @Index()
  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Index()
  @Column({
    type: 'enum',
    enum: OrderPaymentStatus,
    default: OrderPaymentStatus.PENDING,
  })
  paymentStatus: OrderPaymentStatus;

  @Column({ type: 'enum', enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  subtotal: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  shippingTotal: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  taxTotal: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  discountTotal: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  total: string;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  /** Stripe Checkout Session id. Multiple NULLs are allowed under a plain
   * unique constraint in Postgres, so no partial-index workaround needed. */
  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  stripeSessionId: string | null;

  @OneToMany(() => VendorOrder, (vendorOrder) => vendorOrder.order)
  vendorOrders: VendorOrder[];

  @OneToMany(() => Payment, (payment) => payment.order)
  payments: Payment[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
