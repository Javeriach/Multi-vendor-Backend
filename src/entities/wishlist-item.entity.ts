import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Product } from './product.entity';
import { Wishlist } from './wishlist.entity';

/** Wishes a Product, not a ProductVariant — the old app's WishedProduct
 * behaved the same way, and variant-level wishlisting isn't a requirement
 * anywhere in the current UI. */
@Entity('wishlist_items')
@Unique('UQ_wishlist_item_wishlist_product', ['wishlist', 'product'])
export class WishlistItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Wishlist, (wishlist) => wishlist.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  @Index()
  wishlist: Wishlist;

  @ManyToOne(() => Product, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  @Index()
  product: Product;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
