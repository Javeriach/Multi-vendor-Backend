import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResult, paginate } from '../common/dto/paginated-result';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { Product } from '../entities/product.entity';
import { Store } from '../entities/store.entity';
import { StoreStatus } from '../entities/enums';
import { User } from '../entities/user.entity';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

const PARTICIPANT_RELATIONS = ['buyer', 'store', 'store.vendor', 'store.vendor.user'];

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationsRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    @InjectRepository(Store)
    private readonly storesRepository: Repository<Store>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  /**
   * Idempotent by (buyer, store) — repeat contact from different product
   * pages reuses the same thread. `productId`, when given, is only ever
   * recorded on first creation (a reference card in the UI); it never
   * changes which thread an existing conversation resolves to.
   */
  async findOrCreateConversation(buyer: User, dto: CreateConversationDto): Promise<Conversation> {
    const store = await this.storesRepository.findOne({
      where: { id: dto.storeId },
      relations: ['vendor', 'vendor.user'],
    });
    if (!store || store.status !== StoreStatus.ACTIVE) {
      throw new NotFoundException('Store not found');
    }
    if (store.vendor.user.id === buyer.id) {
      throw new BadRequestException('You cannot start a conversation with your own store');
    }

    const existing = await this.conversationsRepository.findOne({
      where: { buyer: { id: buyer.id }, store: { id: store.id } },
      relations: PARTICIPANT_RELATIONS,
    });
    if (existing) {
      return existing;
    }

    let startedFromProduct: Product | null = null;
    if (dto.productId) {
      startedFromProduct = await this.productsRepository.findOne({
        where: { id: dto.productId, store: { id: store.id } },
      });
      // A product id that doesn't belong to this store is silently dropped
      // rather than rejected — it only affects a cosmetic "started from"
      // reference card, not authorization, so failing the whole request
      // over it would be the wrong failure mode.
    }

    const conversation = this.conversationsRepository.create({
      buyer,
      store,
      startedFromProduct,
    });
    const saved = await this.conversationsRepository.save(conversation);
    return this.conversationsRepository.findOneOrFail({
      where: { id: saved.id },
      relations: PARTICIPANT_RELATIONS,
    });
  }

  async listConversationsForBuyer(buyer: User): Promise<ConversationSummary[]> {
    const conversations = await this.conversationsRepository.find({
      where: { buyer: { id: buyer.id } },
      relations: [...PARTICIPANT_RELATIONS, 'startedFromProduct'],
      order: { lastMessageAt: { direction: 'DESC', nulls: 'LAST' }, createdAt: 'DESC' },
    });
    return this.attachPreviews(conversations, buyer.id);
  }

  async listConversationsForStore(store: Store, viewerUserId: string): Promise<ConversationSummary[]> {
    const conversations = await this.conversationsRepository.find({
      where: { store: { id: store.id } },
      relations: [...PARTICIPANT_RELATIONS, 'startedFromProduct'],
      order: { lastMessageAt: { direction: 'DESC', nulls: 'LAST' }, createdAt: 'DESC' },
    });
    return this.attachPreviews(conversations, viewerUserId);
  }

  async getMessages(
    requestingUser: User,
    conversationId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<Message>> {
    await this.loadConversationForParticipant(requestingUser, conversationId);

    const [rows, total] = await this.messagesRepository.findAndCount({
      where: { conversation: { id: conversationId } },
      relations: ['sender'],
      order: { createdAt: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });
    // Fetched newest-first for "load older on scroll up" pagination, then
    // reversed so each page renders chronologically within itself.
    return paginate(rows.reverse(), total, query.page, query.limit);
  }

  async sendMessage(sender: User, dto: SendMessageDto): Promise<Message> {
    const conversation = await this.loadConversationForParticipant(sender, dto.conversationId);

    const message = this.messagesRepository.create({
      conversation,
      sender,
      type: dto.type,
      body: dto.body ?? null,
      imageUrl: dto.imageUrl ?? null,
    });
    const saved = await this.messagesRepository.save(message);

    await this.conversationsRepository.update(conversation.id, { lastMessageAt: saved.createdAt });

    return this.messagesRepository.findOneOrFail({
      where: { id: saved.id },
      relations: ['sender', 'conversation', 'conversation.buyer', 'conversation.store', 'conversation.store.vendor', 'conversation.store.vendor.user'],
    });
  }

  async markRead(user: User, conversationId: string): Promise<void> {
    await this.loadConversationForParticipant(user, conversationId);
    await this.messagesRepository
      .createQueryBuilder()
      .update(Message)
      .set({ readAt: () => 'now()' })
      .where('conversation_id = :conversationId', { conversationId })
      .andWhere('sender_id != :userId', { userId: user.id })
      .andWhere('read_at IS NULL')
      .execute();
  }

  async getUnreadCount(user: User): Promise<number> {
    const qb = this.messagesRepository
      .createQueryBuilder('message')
      .innerJoin('message.conversation', 'conversation')
      .leftJoin('conversation.store', 'store')
      .leftJoin('store.vendor', 'vendor')
      .where('message.read_at IS NULL')
      .andWhere('message.sender_id != :userId', { userId: user.id })
      .andWhere('(conversation.buyer_id = :userId OR vendor.user_id = :userId)', { userId: user.id });
    return qb.getCount();
  }

  /** Throws if the conversation doesn't exist or `user` is neither the
   * buyer nor the owning vendor's user — the one authorization check every
   * other chat operation (send, read history, mark read, join room) funnels
   * through. */
  async loadConversationForParticipant(user: User, conversationId: string): Promise<Conversation> {
    const conversation = await this.conversationsRepository.findOne({
      where: { id: conversationId },
      relations: PARTICIPANT_RELATIONS,
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    const isBuyer = conversation.buyer.id === user.id;
    const isStoreOwner = conversation.store.vendor.user.id === user.id;
    if (!isBuyer && !isStoreOwner) {
      throw new ForbiddenException('You do not have access to this conversation');
    }
    return conversation;
  }

  /** Batches the last-message-preview and unread-count lookups for a whole
   * conversation list into two queries total (not one pair per
   * conversation) — DISTINCT ON is Postgres' idiomatic "latest row per
   * group" and is index-friendly on (conversation_id, created_at). */
  private async attachPreviews(conversations: Conversation[], viewerUserId: string): Promise<ConversationSummary[]> {
    if (conversations.length === 0) return [];
    const ids = conversations.map((c) => c.id);

    const lastMessages = await this.messagesRepository.query<LastMessageRow[]>(
      `SELECT DISTINCT ON (conversation_id) conversation_id, type, body, image_url, sender_id, created_at
       FROM messages WHERE conversation_id = ANY($1)
       ORDER BY conversation_id, created_at DESC`,
      [ids],
    );
    const lastMessageByConversation = new Map(lastMessages.map((row) => [row.conversation_id, row]));

    const unreadRows = await this.messagesRepository.query<{ conversation_id: string; count: number }[]>(
      `SELECT conversation_id, COUNT(*)::int AS count
       FROM messages WHERE conversation_id = ANY($1) AND read_at IS NULL AND sender_id != $2
       GROUP BY conversation_id`,
      [ids, viewerUserId],
    );
    const unreadByConversation = new Map(unreadRows.map((row) => [row.conversation_id, row.count]));

    return conversations.map((conversation) => ({
      ...conversation,
      isViewerBuyer: conversation.buyer.id === viewerUserId,
      lastMessage: lastMessageByConversation.get(conversation.id) ?? null,
      unreadCount: unreadByConversation.get(conversation.id) ?? 0,
    }));
  }
}

interface LastMessageRow {
  conversation_id: string;
  type: string;
  body: string | null;
  image_url: string | null;
  sender_id: string;
  created_at: string;
}

export interface ConversationSummary extends Conversation {
  isViewerBuyer: boolean;
  lastMessage: LastMessageRow | null;
  unreadCount: number;
}
