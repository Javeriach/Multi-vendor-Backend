import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../entities/product.entity';
import { Wishlist } from '../entities/wishlist.entity';
import { WishlistItem } from '../entities/wishlist-item.entity';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';

@Module({
  imports: [TypeOrmModule.forFeature([Wishlist, WishlistItem, Product])],
  controllers: [WishlistController],
  providers: [WishlistService],
})
export class WishlistModule {}
