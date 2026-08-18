import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { VendorStatus } from '../../entities/enums';

export class VendorsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(VendorStatus)
  status?: VendorStatus;
}
