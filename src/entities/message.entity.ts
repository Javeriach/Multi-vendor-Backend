import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Conversation } from './conversation.entity';
import { MessageType } from './enums';
import { User } from './user.entity';

@Entity('messages')
@Check(
  'CHK_message_content_matches_type',
  `("type" = 'text' AND "body" IS NOT NULL) OR ("type" = 'image' AND "image_url" IS NOT NULL)`,
)
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Conversation, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  @Index()
  conversation: Conversation;

  /** Either the buyer or the vendor's own user account — never trust a
   * client-supplied sender id; the gateway/controller always sets this from
   * the authenticated connection. */
  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  @Index()
  sender: User;

  @Column({ type: 'enum', enum: MessageType, default: MessageType.TEXT })
  type: MessageType;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;

  /** Set once the recipient has opened the conversation — drives the unread
   * badge count. Null means unread. */
  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
