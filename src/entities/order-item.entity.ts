import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProductVariant } from './product-variant.entity';
import { VendorOrder } from './vendor-order.entity';

/**
 * Fully self-describing on purpose: `productNameSnapshot`/`skuSnapshot`/
 * `variantAttributesSnapshot`/`unitPrice` are captured at purchase time and
 * never re-read from the live Product/ProductVariant. Combined with
 * `variant` being nullable + ON DELETE SET NULL, a vendor deleting or
 * repricing a product can never corrupt or break a past order.
 */
@Entity('order_items')
@Check('CHK_order_item_quantity_positive', '"quantity" > 0')
@Check('CHK_order_item_unit_price_non_negative', '"unit_price" >= 0')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => VendorOrder, (vendorOrder) => vendorOrder.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  @Index()
  vendorOrder: VendorOrder;

  @ManyToOne(() => ProductVariant, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  @Index()
  variant: ProductVariant | null;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  unitPrice: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  total: string;

  @Column({ type: 'varchar', length: 255 })
  productNameSnapshot: string;

  @Column({ type: 'varchar', length: 100 })
  skuSnapshot: string;

  @Column({ type: 'jsonb', nullable: true })
  variantAttributesSnapshot: Record<string, string> | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imageUrlSnapshot: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
