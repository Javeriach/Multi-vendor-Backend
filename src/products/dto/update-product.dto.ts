import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { ProductStatus } from '../../entities/enums';
import { CreateProductDto } from './create-product.dto';

/** Variants are managed through their own dedicated endpoints
 * (ProductVariantsController), not through a product PATCH — updating a
 * live variant's price/stock is a distinct, more sensitive operation than
 * editing the product's name/description. */
export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['variants'] as const),
) {
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}
