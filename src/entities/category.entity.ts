import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';

/**
 * `UQ_category_parent_name` (parent_id, name) stops two siblings under the
 * SAME parent sharing a name (e.g. two "Accessories" under "Men"), but a
 * plain composite unique constraint can't stop duplicate ROOT names, since
 * Postgres treats every NULL parent_id as distinct. A separate partial
 * unique index (`name` WHERE parent_id IS NULL) closes that gap — see the
 * migration.
 */
@Entity('categories')
@Unique('UQ_category_parent_name', ['parent', 'name'])
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  backgroundColor: string | null;

  @ManyToOne(() => Category, (category) => category.children, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn()
  @Index()
  parent: Category | null;

  @OneToMany(() => Category, (category) => category.parent)
  children: Category[];

  @OneToMany(() => Product, (product) => product.category)
  products: Product[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
