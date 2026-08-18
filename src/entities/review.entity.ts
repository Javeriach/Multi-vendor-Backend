import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { OrderItem } from './order-item.entity';
import { Product } from './product.entity';
import { User } from './user.entity';

/**
 * `orderItem` proves purchase, but a foreign key alone doesn't prove THIS
 * user bought THIS product — nothing stops an insert with someone else's
 * orderItemId. ReviewsService.create() must verify, inside the same
 * transaction as the insert:
 *   orderItem.vendorOrder.order.user.id === review.user.id
 *   AND orderItem.variant.product.id === review.product.id
 * This is a service-layer invariant the schema cannot enforce alone —
 * documented here so it isn't silently skipped.
 */
@Entity('reviews')
@Unique('UQ_review_user_product', ['user', 'product'])
@Check('CHK_review_rating_range', '"rating" BETWEEN 1 AND 5')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn()
  @Index()
  user: User;

  @ManyToOne(() => Product, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn()
  @Index()
  product: Product;

  @ManyToOne(() => OrderItem, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn()
  orderItem: OrderItem;

  @Column({ type: 'smallint' })
  rating: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
