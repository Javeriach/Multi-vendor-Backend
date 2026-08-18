import { IsEnum, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PaymentMethod } from '../../entities/enums';

/** No product/price/quantity data here on purpose — checkout always reads
 * the customer's cart and current product prices from the database. The
 * only client input is WHICH address, a delivery contact number, and HOW
 * they intend to pay. `contactPhone` is collected here rather than stored
 * on Address, matching the old app's checkout form (phone was always a
 * per-order field, not a saved-address field). */
export class CheckoutDto {
  @IsUUID()
  addressId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  contactPhone: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}
