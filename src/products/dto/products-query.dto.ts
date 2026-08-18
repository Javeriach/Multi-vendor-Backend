import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ProductStatus } from '../../entities/enums';

export const PRODUCT_SORT_OPTIONS = [
  'newest',
  'price_asc',
  'price_desc',
  'rating',
] as const;
export type ProductSort = (typeof PRODUCT_SORT_OPTIONS)[number];

export class ProductsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minRating?: number;

  @IsOptional()
  @IsIn(PRODUCT_SORT_OPTIONS)
  sort?: ProductSort;

  /** Only honored for the vendor/admin-scoped controllers — the public
   * catalog endpoint always forces status=ACTIVE regardless of this field. */
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}
