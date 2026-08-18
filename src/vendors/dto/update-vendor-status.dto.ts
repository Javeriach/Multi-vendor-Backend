import { IsEnum } from 'class-validator';
import { VendorStatus } from '../../entities/enums';

export class UpdateVendorStatusDto {
  @IsEnum(VendorStatus)
  status: VendorStatus;
}
