import { IsEnum, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';
import { MessageType } from '../../entities/enums';

export class SendMessageDto {
  @IsUUID()
  conversationId: string;

  @IsEnum(MessageType)
  type: MessageType;

  @ValidateIf((o: SendMessageDto) => o.type === MessageType.TEXT)
  @IsString()
  @MaxLength(4000)
  body?: string;

  /** Uploaded via POST /uploads/image first (Cloudinary) — this carries the
   * resulting URL, never a raw file. */
  @ValidateIf((o: SendMessageDto) => o.type === MessageType.IMAGE)
  @IsString()
  imageUrl?: string;
}
