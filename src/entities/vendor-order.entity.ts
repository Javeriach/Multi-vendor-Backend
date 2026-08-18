import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { VendorOrderStatus } from './enums';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { Store } from './store.entity';

/**
 * The middle tier that makes multi-vendor checkout possible: one Order can
 * fan out into several VendorOrders (one per Store in the cart), each
 * independently trackable for fulfillment. Never hard-deleted — same
 * immutability rule as Order.
 */
@Entity('vendor_orders')
@Unique('UQ_vendor_order_order_store', ['order', 'store'])
export class VendorOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, (order) => order.vendorOrders, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  @Index()
  order: Order;

  @ManyToOne(() => Store, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn()
  @Index()
  store: Store;

  @Index()
  @Column({
    type: 'enum',
    enum: VendorOrderStatus,
    default: VendorOrderStatus.PROCESSING,
  })
  status: VendorOrderStatus;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  subtotal: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  shippingFee: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  commissionRateSnapshot: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  commissionAmount: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  total: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  trackingNumber: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  trackingCarrier: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  shippedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  @OneToMany(() => OrderItem, (item) => item.vendorOrder)
  items: OrderItem[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
