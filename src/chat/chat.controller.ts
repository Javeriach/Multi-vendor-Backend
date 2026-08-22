import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginatedResult } from '../common/dto/paginated-result';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { VendorApprovedGuard } from '../common/guards/vendor-approved.guard';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { UserRole } from '../entities/enums';
import { User } from '../entities/user.entity';
import { VendorsService } from '../vendors/vendors.service';
import { ChatService, ConversationSummary } from './chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';

@Roles(UserRole.CUSTOMER, UserRole.VENDOR)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly vendorsService: VendorsService,
  ) {}

  /** "Chat with seller" — buyer-initiated, works for any logged-in role
   * (a vendor account can browse and message other stores as a buyer too). */
  @Post('conversations')
  createConversation(@CurrentUser() user: User, @Body() dto: CreateConversationDto): Promise<Conversation> {
    return this.chatService.findOrCreateConversation(user, dto);
  }

  @Get('conversations')
  listMine(@CurrentUser() user: User): Promise<ConversationSummary[]> {
    return this.chatService.listConversationsForBuyer(user);
  }

  @UseGuards(VendorApprovedGuard)
  @Get('vendor/conversations')
  async listForMyStore(@CurrentUser() user: User): Promise<ConversationSummary[]> {
    const vendor = await this.vendorsService.findMine(user.id);
    const store = await this.vendorsService.getStoreForVendor(vendor.id);
    return this.chatService.listConversationsForStore(store, user.id);
  }

  @Get('conversations/:id/messages')
  getMessages(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<Message>> {
    return this.chatService.getMessages(user, id, query);
  }

  /** REST fallback for marking read on initial page load, before the socket
   * connection is established — the socket event does the same thing for
   * everything after that. */
  @Post('conversations/:id/read')
  async markRead(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string): Promise<{ ok: true }> {
    await this.chatService.markRead(user, id);
    return { ok: true };
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: User): Promise<{ count: number }> {
    const count = await this.chatService.getUnreadCount(user);
    return { count };
  }
}
