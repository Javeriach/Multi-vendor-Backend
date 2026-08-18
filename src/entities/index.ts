import { Address } from './address.entity';
import { Cart } from './cart.entity';
import { CartItem } from './cart-item.entity';
import { Category } from './category.entity';
import { Inventory } from './inventory.entity';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { Payment } from './payment.entity';
import { Product } from './product.entity';
import { ProductImage } from './product-image.entity';
import { ProductVariant } from './product-variant.entity';
import { Review } from './review.entity';
import { Store } from './store.entity';
import { User } from './user.entity';
import { Vendor } from './vendor.entity';
import { VendorOrder } from './vendor-order.entity';
import { Wishlist } from './wishlist.entity';
import { WishlistItem } from './wishlist-item.entity';

export {
  Address,
  Cart,
  CartItem,
  Category,
  Inventory,
  Order,
  OrderItem,
  Payment,
  Product,
  ProductImage,
  ProductVariant,
  Review,
  Store,
  User,
  Vendor,
  VendorOrder,
  Wishlist,
  WishlistItem,
};

/** Single source of truth for both the NestJS module (app.module.ts) and the
 * standalone TypeORM CLI data source (database/data-source.ts), so the two
 * can never drift out of sync with each other. */
export const entities = [
  User,
  Vendor,
  Store,
  Category,
  Product,
  ProductImage,
  ProductVariant,
  Inventory,
  Address,
  Cart,
  CartItem,
  Wishlist,
  WishlistItem,
  Order,
  VendorOrder,
  OrderItem,
  Payment,
  Review,
];
