import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { OrderPaymentStatus, OrderStatus, VendorOrderStatus } from '../../entities/enums';

export class OrdersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(OrderPaymentStatus)
  paymentStatus?: OrderPaymentStatus;
}

export class VendorOrdersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(VendorOrderStatus)
  status?: VendorOrderStatus;
}
