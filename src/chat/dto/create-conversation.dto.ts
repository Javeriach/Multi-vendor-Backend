import { IsOptional, IsUUID } from 'class-validator';

export class CreateConversationDto {
  @IsUUID()
  storeId: string;

  /** Just the context the thread was opened from — never a scoping key.
   * See Conversation entity for why. */
  @IsOptional()
  @IsUUID()
  productId?: string;
}
