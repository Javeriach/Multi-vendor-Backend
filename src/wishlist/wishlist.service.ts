import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { User } from '../entities/user.entity';
import { Wishlist } from '../entities/wishlist.entity';
import { WishlistItem } from '../entities/wishlist-item.entity';

const WISHLIST_RELATIONS = ['items', 'items.product', 'items.product.images', 'items.product.store'];

@Injectable()
export class WishlistService {
  constructor(
    @InjectRepository(Wishlist)
    private readonly wishlistRepository: Repository<Wishlist>,
    @InjectRepository(WishlistItem)
    private readonly wishlistItemRepository: Repository<WishlistItem>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  async getMine(user: User): Promise<Wishlist> {
    return this.getOrCreateWishlist(user);
  }

  async addItem(user: User, productId: string): Promise<Wishlist> {
    const product = await this.productsRepository.findOne({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const wishlist = await this.getOrCreateWishlist(user);
    const exists = await this.wishlistItemRepository.exist({
      where: { wishlist: { id: wishlist.id }, product: { id: productId } },
    });
    if (exists) {
      throw new ConflictException('Product is already in your wishlist');
    }

    const item = this.wishlistItemRepository.create({ wishlist, product });
    await this.wishlistItemRepository.save(item);

    return this.getOrCreateWishlist(user);
  }

  async removeItem(user: User, productId: string): Promise<Wishlist> {
    const wishlist = await this.getOrCreateWishlist(user);
    await this.wishlistItemRepository.delete({
      wishlist: { id: wishlist.id },
      product: { id: productId },
    });
    return this.getOrCreateWishlist(user);
  }

  private async getOrCreateWishlist(user: User): Promise<Wishlist> {
    let wishlist = await this.wishlistRepository.findOne({
      where: { user: { id: user.id } },
      relations: WISHLIST_RELATIONS,
    });
    if (!wishlist) {
      wishlist = this.wishlistRepository.create({ user, items: [] });
      wishlist = await this.wishlistRepository.save(wishlist);
    }
    return wishlist;
  }
}
