import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { WishlistItem } from './wishlist-item.entity';

@Entity('wishlists')
export class Wishlist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (user) => user.wishlist, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  @Index({ unique: true })
  user: User;

  @OneToMany(() => WishlistItem, (item) => item.wishlist, {
    cascade: ['insert'],
  })
  items: WishlistItem[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
