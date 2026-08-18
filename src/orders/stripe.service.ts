import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly client: Stripe;

  constructor(private readonly configService: ConfigService) {
    this.client = new Stripe(this.configService.get<string>('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2025-02-24.acacia',
    });
  }

  createCheckoutSession(params: {
    orderId: string;
    orderNumber: string;
    currency: string;
    customerEmail: string;
    /** One entry per product variant, already priced server-side from live
     * product data — never trust a client-supplied amount here. Rendered by
     * Stripe as real line items on its hosted checkout page instead of a
     * single opaque "Order X" line, so a buyer can see what they're paying
     * for before paying. */
    lineItems: { name: string; quantity: number; unitAmountCents: number; imageUrl?: string }[];
  }): Promise<Stripe.Checkout.Session> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

    return this.client.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: params.customerEmail,
      line_items: params.lineItems.map((item) => ({
        price_data: {
          currency: params.currency.toLowerCase(),
          product_data: {
            name: item.name,
            // Stripe silently ignores non-public (e.g. localhost) image
            // URLs rather than erroring — harmless in local dev, and works
            // for real once the backend is deployed behind a public host.
            images: item.imageUrl ? [item.imageUrl] : undefined,
          },
          unit_amount: item.unitAmountCents,
        },
        quantity: item.quantity,
      })),
      metadata: { orderId: params.orderId, orderNumber: params.orderNumber },
      success_url: `${frontendUrl}/orders/${params.orderId}?payment=success`,
      cancel_url: `${frontendUrl}/checkout?payment=cancelled`,
    });
  }

  constructWebhookEvent(rawBody: Buffer, signature: string, webhookSecret: string): Stripe.Event {
    return this.client.webhooks.constructEvent(rawBody, signature, webhookSecret);
  }
}
