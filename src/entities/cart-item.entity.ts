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
  UpdateDateColumn,
} from 'typeorm';
import { Cart } from './cart.entity';
import { ProductVariant } from './product-variant.entity';

/** Disposable — cascades from both Cart AND ProductVariant. Contrast with
 * OrderItem, which snapshots data and never cascades from the variant, since
 * a cart entry has no historical/financial meaning once its target is gone. */
@Entity('cart_items')
@Unique('UQ_cart_item_cart_variant', ['cart', 'variant'])
@Check('CHK_cart_item_quantity_positive', '"quantity" > 0')
export class CartItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Cart, (cart) => cart.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  @Index()
  cart: Cart;

  @ManyToOne(() => ProductVariant, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  @Index()
  variant: ProductVariant;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ type: 'boolean', default: true })
  selectedForPurchase: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
