import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CartItem } from './cart-item.entity';
import { User } from './user.entity';

/** Purely ephemeral working state — hard-cascades on user delete, unlike
 * Order (see order.entity.ts for why the two differ). */
@Entity('carts')
export class Cart {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (user) => user.cart, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  @Index({ unique: true })
  user: User;

  @OneToMany(() => CartItem, (item) => item.cart, { cascade: ['insert'] })
  items: CartItem[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
