import { IsUUID } from 'class-validator';

/** Shared shape for the two WS events that only need a conversation id:
 * conversation:join and conversation:markRead. */
export class ConversationRoomDto {
  @IsUUID()
  conversationId: string;
}
