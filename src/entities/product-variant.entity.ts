import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Inventory } from './inventory.entity';
import { Product } from './product.entity';

/**
 * `price`/`discountPrice` map to JS `string`, not `number` — this is
 * deliberate. TypeORM returns Postgres `numeric` as a string specifically to
 * avoid floating-point rounding in money values; application code doing
 * arithmetic on these should use a decimal library, never native +/-.
 *
 * Soft-deleted (never hard-deleted) for the same historical-order-integrity
 * reason as Product — see that entity's note.
 */
@Entity('product_variants')
@Check('CHK_variant_price_non_negative', '"price" >= 0')
@Check(
  'CHK_variant_discount_price_valid',
  '"discount_price" IS NULL OR "discount_price" <= "price"',
)
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Product, (product) => product.variants, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  @Index()
  product: Product;

  @Column({ type: 'varchar', length: 100, unique: true })
  sku: string;

  @Column({ type: 'jsonb', nullable: true })
  attributes: Record<string, string> | null;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  price: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  discountPrice: string | null;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @OneToOne(() => Inventory, (inventory) => inventory.variant)
  inventory?: Inventory;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
