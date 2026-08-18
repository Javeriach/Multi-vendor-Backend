import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProductVariant } from './product-variant.entity';

/**
 * Reservation protocol (enforced by application code in a later phase, not
 * by this schema alone):
 *  1. Reserve  — reservedQuantity += qty when a checkout session opens.
 *  2. Commit   — stockQuantity -= qty AND reservedQuantity -= qty together,
 *                atomically, when payment is confirmed.
 *  3. Release  — reservedQuantity -= qty if checkout fails/expires/abandons.
 * The CHECK below guarantees reservedQuantity can never exceed stockQuantity
 * regardless of which code path updates it.
 */
@Entity('inventory')
@Check('CHK_inventory_stock_non_negative', '"stock_quantity" >= 0')
@Check('CHK_inventory_reserved_non_negative', '"reserved_quantity" >= 0')
@Check('CHK_inventory_reserved_lte_stock', '"reserved_quantity" <= "stock_quantity"')
export class Inventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => ProductVariant, (variant) => variant.inventory, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  @Index({ unique: true })
  variant: ProductVariant;

  @Column({ type: 'integer', default: 0 })
  stockQuantity: number;

  @Column({ type: 'integer', default: 0 })
  reservedQuantity: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
