import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Inventory } from '../entities/inventory.entity';
import { Product } from '../entities/product.entity';
import { ProductImage } from '../entities/product-image.entity';
import { ProductVariant } from '../entities/product-variant.entity';
import { VendorsModule } from '../vendors/vendors.module';
import {
  AdminProductsController,
  ProductsController,
  VendorProductsController,
} from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductVariant, Inventory, ProductImage]),
    VendorsModule,
  ],
  controllers: [ProductsController, VendorProductsController, AdminProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
