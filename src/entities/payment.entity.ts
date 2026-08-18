import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Order } from './order.entity';
import { PaymentStatus, PaymentType } from './enums';

/**
 * A ledger, not a mutable counter: every charge AND every refund is its own
 * row. A refund sets `type = REFUND` and points at the original charge via
 * `parentPayment`; "how much has been refunded" is a SUM() over child rows,
 * never a field that can silently drift from reality.
 *
 * `UNIQUE(provider, providerRef)` makes webhook processing idempotent at the
 * database level — Stripe (and most providers) can and will redeliver the
 * same event more than once; this constraint turns "insert on webhook" into
 * a safe no-op on redelivery instead of a duplicate charge record.
 */
@Entity('payments')
@Unique('UQ_payment_provider_ref', ['provider', 'providerRef'])
@Check(
  'CHK_payment_refund_has_parent',
  `("type" = 'refund' AND "parent_payment_id" IS NOT NULL) OR ("type" = 'charge' AND "parent_payment_id" IS NULL)`,
)
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, (order) => order.payments, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn()
  @Index()
  order: Order;

  @Column({ type: 'enum', enum: PaymentType })
  type: PaymentType;

  @ManyToOne(() => Payment, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn()
  parentPayment: Payment | null;

  @Column({ type: 'varchar', length: 50 })
  provider: string;

  @Column({ type: 'varchar', length: 255 })
  providerRef: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Index()
  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ type: 'text', nullable: true })
  failureReason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  succeededAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
