import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

/** Sets absolute stock, not a delta — simpler and less error-prone for a
 * vendor doing a manual stock count than "add/subtract N". Order processing
 * itself decrements stock through a separate, transactional code path
 * (OrdersService), never through this endpoint. */
export class AdjustStockDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockQuantity: number;
}
