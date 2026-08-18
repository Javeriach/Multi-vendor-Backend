import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddressesModule } from '../addresses/addresses.module';
import { Cart } from '../entities/cart.entity';
import { CartItem } from '../entities/cart-item.entity';
import { Inventory } from '../entities/inventory.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Order } from '../entities/order.entity';
import { Payment } from '../entities/payment.entity';
import { VendorOrder } from '../entities/vendor-order.entity';
import { VendorsModule } from '../vendors/vendors.module';
import {
  AdminOrdersController,
  CheckoutController,
  OrdersController,
  VendorOrdersController,
} from './orders.controller';
import { OrdersService } from './orders.service';
import { StripeService } from './stripe.service';
import { StripeWebhookController } from './webhook.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, VendorOrder, OrderItem, Payment, Cart, CartItem, Inventory]),
    AddressesModule,
    VendorsModule,
  ],
  controllers: [
    OrdersController,
    CheckoutController,
    VendorOrdersController,
    AdminOrdersController,
    StripeWebhookController,
  ],
  providers: [OrdersService, StripeService],
  exports: [OrdersService],
})
export class OrdersModule {}
