import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductStatus } from '../entities/enums';
import { Cart } from '../entities/cart.entity';
import { CartItem } from '../entities/cart-item.entity';
import { ProductVariant } from '../entities/product-variant.entity';
import { User } from '../entities/user.entity';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

const CART_RELATIONS = [
  'items',
  'items.variant',
  'items.variant.product',
  'items.variant.product.images',
  'items.variant.product.store',
  'items.variant.inventory',
];

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart)
    private readonly cartRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,
    @InjectRepository(ProductVariant)
    private readonly variantsRepository: Repository<ProductVariant>,
  ) {}

  async getMine(user: User): Promise<Cart> {
    return this.getOrCreateCart(user);
  }

  async addItem(user: User, dto: AddCartItemDto): Promise<Cart> {
    const variant = await this.loadPurchasableVariant(dto.variantId);
    const cart = await this.getOrCreateCart(user);

    let item = await this.cartItemRepository.findOne({
      where: { cart: { id: cart.id }, variant: { id: variant.id } },
    });

    const requestedQuantity = (item?.quantity ?? 0) + dto.quantity;
    this.assertStockAvailable(variant, requestedQuantity);

    if (item) {
      item.quantity = requestedQuantity;
    } else {
      item = this.cartItemRepository.create({ cart, variant, quantity: dto.quantity });
    }
    await this.cartItemRepository.save(item);

    return this.getOrCreateCart(user);
  }

  async updateItem(user: User, itemId: string, dto: UpdateCartItemDto): Promise<Cart> {
    const item = await this.findOwnedItem(user, itemId);

    if (dto.quantity !== undefined) {
      this.assertStockAvailable(item.variant, dto.quantity);
      item.quantity = dto.quantity;
    }
    if (dto.selectedForPurchase !== undefined) {
      item.selectedForPurchase = dto.selectedForPurchase;
    }
    await this.cartItemRepository.save(item);

    return this.getOrCreateCart(user);
  }

  async removeItem(user: User, itemId: string): Promise<Cart> {
    const item = await this.findOwnedItem(user, itemId);
    await this.cartItemRepository.remove(item);
    return this.getOrCreateCart(user);
  }

  async clear(user: User): Promise<Cart> {
    const cart = await this.getOrCreateCart(user);
    if (cart.items.length > 0) {
      await this.cartItemRepository.remove(cart.items);
    }
    return this.getOrCreateCart(user);
  }

  private async loadPurchasableVariant(variantId: string): Promise<ProductVariant> {
    const variant = await this.variantsRepository.findOne({
      where: { id: variantId },
      relations: ['product', 'inventory'],
    });
    if (!variant || variant.product.status !== ProductStatus.ACTIVE) {
      throw new NotFoundException('Product is not available');
    }
    return variant;
  }

  private assertStockAvailable(variant: ProductVariant, quantity: number): void {
    const available = (variant.inventory?.stockQuantity ?? 0) - (variant.inventory?.reservedQuantity ?? 0);
    if (quantity > available) {
      throw new ConflictException(
        `Only ${Math.max(available, 0)} unit(s) of "${variant.product.name}" are available`,
      );
    }
  }

  private async findOwnedItem(user: User, itemId: string): Promise<CartItem> {
    const item = await this.cartItemRepository.findOne({
      where: { id: itemId, cart: { user: { id: user.id } } },
      relations: ['variant', 'variant.product', 'variant.inventory'],
    });
    if (!item) {
      throw new NotFoundException('Cart item not found');
    }
    return item;
  }

  private async getOrCreateCart(user: User): Promise<Cart> {
    let cart = await this.cartRepository.findOne({
      where: { user: { id: user.id } },
      relations: CART_RELATIONS,
    });
    if (!cart) {
      cart = this.cartRepository.create({ user, items: [] });
      cart = await this.cartRepository.save(cart);
    }
    return cart;
  }
}
