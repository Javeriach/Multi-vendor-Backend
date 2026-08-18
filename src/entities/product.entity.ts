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
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from './category.entity';
import { ProductStatus } from './enums';
import { ProductImage } from './product-image.entity';
import { ProductVariant } from './product-variant.entity';
import { Review } from './review.entity';
import { Store } from './store.entity';

/**
 * Soft-deleted, never hard-deleted, by design: a future `OrderItem` (Phase 6+)
 * will snapshot product name/SKU/price at purchase time and hold its
 * `variantId` as a nullable `ON DELETE SET NULL` reference, specifically so a
 * vendor deleting a product can never corrupt historical order data. Soft
 * delete here is what makes that guarantee meaningful in practice.
 */
@Entity('products')
@Unique('UQ_product_store_slug', ['store', 'slug'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Store, (store) => store.products, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn()
  @Index()
  store: Store;

  @ManyToOne(() => Category, (category) => category.products, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn()
  @Index()
  category: Category;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Index()
  @Column({ type: 'enum', enum: ProductStatus, default: ProductStatus.DRAFT })
  status: ProductStatus;

  /** Maintained by ReviewsService on every review create/update/delete —
   * never written directly by any other code path. Price/SKU are
   * deliberately NOT duplicated here; they live only on ProductVariant
   * (every product has at least one variant) to avoid a dual-source-of-truth
   * drift between Product and its variants. */
  @Column({ type: 'numeric', precision: 3, scale: 2, default: 0 })
  ratingAverage: string;

  @Column({ type: 'integer', default: 0 })
  reviewCount: number;

  @OneToMany(() => ProductImage, (image) => image.product)
  images: ProductImage[];

  @OneToMany(() => ProductVariant, (variant) => variant.product)
  variants: ProductVariant[];

  @OneToMany(() => Review, (review) => review.product)
  reviews: Review[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
