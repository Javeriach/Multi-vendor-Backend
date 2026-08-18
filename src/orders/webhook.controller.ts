import {
  BadRequestException,
  Controller,
  Headers,
  Logger,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import Stripe from 'stripe';
import { Public } from '../common/decorators/public.decorator';
import { OrdersService } from './orders.service';
import { StripeService } from './stripe.service';

/**
 * The webhook is the ONLY thing that ever marks an order paid — never the
 * frontend's "I got redirected to the success URL" (that redirect happens
 * on the customer's browser and proves nothing about whether Stripe actually
 * confirmed the charge). Signature verification means only Stripe, holding
 * the shared webhook secret, can trigger this.
 */
@Controller('webhooks/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger('StripeWebhook');

  constructor(
    private readonly ordersService: OrdersService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post()
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: true }> {
    if (!req.rawBody) {
      throw new BadRequestException('Missing raw request body for signature verification');
    }

    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
    let event: Stripe.Event;
    try {
      event = this.stripeService.constructWebhookEvent(req.rawBody, signature, webhookSecret);
    } catch (err) {
      this.logger.warn(`Stripe webhook signature verification failed: ${(err as Error).message}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status === 'paid') {
          await this.ordersService.handleCheckoutSessionCompleted(session.id);
        } else {
          await this.ordersService.handleCheckoutSessionFailedOrExpired(session.id);
        }
        break;
      }
      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        await this.ordersService.handleCheckoutSessionFailedOrExpired(session.id);
        break;
      }
      default:
        // Unhandled event types are intentionally ignored, not errored —
        // Stripe sends far more event types than this integration acts on.
        break;
    }

    return { received: true };
  }
}
