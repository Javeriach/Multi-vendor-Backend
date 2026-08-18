import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { VendorApprovedGuard } from '../common/guards/vendor-approved.guard';
import { UseGuards } from '@nestjs/common';
import { PaginatedResult } from '../common/dto/paginated-result';
import { ProductStatus, UserRole } from '../entities/enums';
import { Inventory } from '../entities/inventory.entity';
import { Product } from '../entities/product.entity';
import { ProductVariant } from '../entities/product-variant.entity';
import { User } from '../entities/user.entity';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateVariantDto } from './dto/create-variant.dto';
import { ProductsQueryDto } from './dto/products-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { ProductsService } from './products.service';

// -------------------------------------------------------------- public

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  search(@Query() query: ProductsQueryDto): Promise<PaginatedResult<Product>> {
    return this.productsService.search(query);
  }

  @Public()
  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string): Promise<Product> {
    return this.productsService.findBySlugPublic(slug);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Product> {
    return this.productsService.findByIdPublic(id);
  }
}

// --------------------------------------------------------------- vendor

@Roles(UserRole.VENDOR)
@Controller('vendor/products')
export class VendorProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findMine(
    @CurrentUser() user: User,
    @Query() query: ProductsQueryDto,
  ): Promise<PaginatedResult<Product>> {
    return this.productsService.findAllForVendor(user, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string): Promise<Product> {
    return this.productsService.findOneForVendor(user, id);
  }

  @UseGuards(VendorApprovedGuard)
  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateProductDto): Promise<Product> {
    return this.productsService.create(user, dto);
  }

  @UseGuards(VendorApprovedGuard)
  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<Product> {
    return this.productsService.update(user, id, dto);
  }

  @UseGuards(VendorApprovedGuard)
  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.productsService.remove(user, id);
  }

  @UseGuards(VendorApprovedGuard)
  @Post(':id/variants')
  addVariant(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVariantDto,
  ): Promise<ProductVariant> {
    return this.productsService.addVariant(user, id, dto);
  }

  @UseGuards(VendorApprovedGuard)
  @Patch(':id/variants/:variantId')
  updateVariant(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: UpdateVariantDto,
  ): Promise<ProductVariant> {
    return this.productsService.updateVariant(user, id, variantId, dto);
  }

  @UseGuards(VendorApprovedGuard)
  @Delete(':id/variants/:variantId')
  removeVariant(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
  ): Promise<void> {
    return this.productsService.removeVariant(user, id, variantId);
  }

  @UseGuards(VendorApprovedGuard)
  @Patch(':id/variants/:variantId/stock')
  adjustStock(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: AdjustStockDto,
  ): Promise<Inventory> {
    return this.productsService.adjustStock(user, id, variantId, dto);
  }
}

// ---------------------------------------------------------------- admin

@Roles(UserRole.ADMIN)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(@Query() query: ProductsQueryDto): Promise<PaginatedResult<Product>> {
    return this.productsService.adminFindAll(query);
  }

  @Patch(':id/status')
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: ProductStatus,
  ): Promise<Product> {
    return this.productsService.adminSetStatus(id, status);
  }
}
