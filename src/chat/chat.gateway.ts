import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { instanceToPlain } from 'class-transformer';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { User } from '../entities/user.entity';
import { UsersService } from '../users/users.service';
import { ChatService } from './chat.service';
import { ConversationRoomDto } from './dto/conversation-room.dto';
import { SendMessageDto } from './dto/send-message.dto';

interface AuthenticatedSocket extends Socket {
  data: { user: User };
}

function userRoom(userId: string): string {
  return `user:${userId}`;
}

function conversationRoom(conversationId: string): string {
  return `conversation:${conversationId}`;
}

/**
 * Namespaced under /chat so this doesn't collide with any future gateway on
 * the same server. Real origin restriction already happens once at
 * bootstrap (app.enableCors in create-app.ts); `origin: true` here just
 * means "don't double-guess it — reflect whatever origin the browser sent"
 * so the handshake itself isn't a second, easy-to-drift place to keep a
 * CORS allowlist in sync.
 */
@WebSocketGateway({ cors: { origin: true, credentials: true }, namespace: '/chat' })
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger('ChatGateway');

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly chatService: ChatService,
  ) {}

  /**
   * Authenticates in Socket.IO namespace middleware (`server.use`), NOT in
   * handleConnection. Middleware is guaranteed by Socket.IO to finish
   * before the client ever receives its 'connect' ack; handleConnection
   * fires AFTER that ack, as a separate async hook with no such guarantee.
   * A client that immediately emits an event after 'connect' (which every
   * real client does — see the frontend's `useChatSocket` hook) can and
   * did race handleConnection's DB lookup, arriving before
   * `client.data.user` was ever set. Middleware closes that window
   * entirely: by the time 'connect' fires, `socket.data.user` already
   * exists, full stop.
   *
   * Every connection must present the same JWT used for REST auth (cookie,
   * matching JwtStrategy's cookieExtractor — or an `auth.token` handshake
   * field for non-browser/cross-site clients where the cookie can't ride
   * along). Re-fetches the User row rather than trusting the token payload,
   * for the same reason JwtStrategy does: a role change or deactivation
   * takes effect on the very next connection attempt, not only after the
   * token expires.
   */
  afterInit(server: Server): void {
    server.use((socket: AuthenticatedSocket, next) => {
      this.authenticate(socket)
        .then(() => next())
        .catch((err: Error) => {
          this.logger.warn(`Rejected connection: ${err.message}`);
          next(err);
        });
    });
  }

  private async authenticate(client: AuthenticatedSocket): Promise<void> {
    const token = this.extractToken(client);
    const payload = this.jwtService.verify<JwtPayload>(token, {
      secret: this.configService.get<string>('JWT_SECRET'),
    });
    const user = await this.usersService.findByIdWithVendor(payload.sub);
    if (!user) {
      throw new Error('Account not found or has been deactivated');
    }
    client.data.user = user;
  }

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    await client.join(userRoom(client.data.user.id));
    this.logger.log(`Connected: user ${client.data.user.id}`);
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    if (client.data?.user) {
      this.logger.log(`Disconnected: user ${client.data.user.id}`);
    }
  }

  /** Joining the room is itself the authorization check — a user who isn't
   * a participant never receives that conversation's events, full stop,
   * regardless of what conversationId a malicious client might guess.
   *
   * The validation pipe is applied to @MessageBody() specifically, not via
   * a method-level @UsePipes() — a method-level pipe runs on EVERY
   * parameter including @ConnectedSocket(), and ValidationPipe attempting
   * to plainToInstance/validate a socket.io Socket (a complex object with
   * circular refs) silently produces a broken client argument instead of
   * throwing somewhere obvious. */
  @SubscribeMessage('conversation:join')
  async onJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody(new ValidationPipe({ whitelist: true, transform: true })) data: ConversationRoomDto,
  ): Promise<void> {
    await this.chatService.loadConversationForParticipant(client.data.user, data.conversationId);
    await client.join(conversationRoom(data.conversationId));
  }

  @SubscribeMessage('conversation:leave')
  async onLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody(new ValidationPipe({ whitelist: true, transform: true })) data: ConversationRoomDto,
  ): Promise<void> {
    await client.leave(conversationRoom(data.conversationId));
  }

  @SubscribeMessage('message:send')
  async onSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody(new ValidationPipe({ whitelist: true, transform: true })) dto: SendMessageDto,
  ) {
    const message = await this.chatService.sendMessage(client.data.user, dto);

    // ClassSerializerInterceptor (which strips @Exclude() fields like
    // User.passwordHash) only runs on HTTP responses — a manual .emit()
    // here is raw JSON.stringify of the entity, so without this the
    // sender's password hash would go out over the wire on every message.
    this.server.to(conversationRoom(dto.conversationId)).emit('message:new', instanceToPlain(message));

    // The recipient may not currently have this conversation's room joined
    // (e.g. they're looking at their conversation list, not this thread) —
    // their personal room is how the list/unread-badge UI stays live too.
    const recipientId =
      message.conversation.buyer.id === client.data.user.id
        ? message.conversation.store.vendor.user.id
        : message.conversation.buyer.id;
    this.server.to(userRoom(recipientId)).emit('conversation:updated', { conversationId: dto.conversationId });

    return message;
  }

  @SubscribeMessage('conversation:markRead')
  async onMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody(new ValidationPipe({ whitelist: true, transform: true })) data: ConversationRoomDto,
  ): Promise<void> {
    await this.chatService.markRead(client.data.user, data.conversationId);
    this.server.to(conversationRoom(data.conversationId)).emit('conversation:read', {
      conversationId: data.conversationId,
      readByUserId: client.data.user.id,
    });
  }

  private extractToken(client: Socket): string {
    const handshakeToken = (client.handshake.auth as Record<string, unknown> | undefined)?.token;
    if (typeof handshakeToken === 'string' && handshakeToken.length > 0) {
      return handshakeToken;
    }

    const cookieHeader = client.handshake.headers.cookie;
    if (cookieHeader) {
      const match = cookieHeader
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith('access_token='));
      if (match) {
        return decodeURIComponent(match.slice('access_token='.length));
      }
    }

    throw new Error('No authentication token provided');
  }
}
