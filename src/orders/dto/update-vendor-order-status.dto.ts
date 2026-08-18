import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { VendorOrderStatus } from '../../entities/enums';

export class UpdateVendorOrderStatusDto {
  @IsEnum(VendorOrderStatus)
  status: VendorOrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  trackingCarrier?: string;
}
