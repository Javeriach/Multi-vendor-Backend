import {
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
import { Product } from './product.entity';
import { Store } from './store.entity';
import { User } from './user.entity';

/**
 * One conversation per (buyer, store) pair — matches the "chat with this
 * shop" pattern: a buyer messaging a store from two different product pages
 * lands in the same thread, not a new one per product. `startedFromProduct`
 * is just the context the thread began from (shown as a reference card in
 * the UI), never a scoping key — findOrCreate always looks up by
 * (buyer, store) alone.
 */
@Entity('conversations')
@Unique('UQ_conversation_buyer_store', ['buyer', 'store'])
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  @Index()
  buyer: User;

  @ManyToOne(() => Store, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  @Index()
  store: Store;

  @ManyToOne(() => Product, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  startedFromProduct: Product | null;

  /** Denormalized for cheap "most recent first" conversation-list sorting
   * without a join+aggregate over messages on every list request. */
  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
