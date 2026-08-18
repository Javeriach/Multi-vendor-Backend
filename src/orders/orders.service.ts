import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AddressesService } from '../addresses/addresses.service';
import { CartItem } from '../entities/cart-item.entity';
import { Cart } from '../entities/cart.entity';
import {
  OrderPaymentStatus,
  OrderStatus,
  PaymentStatus,
  PaymentType,
  ProductStatus,
  VendorOrderStatus,
} from '../entities/enums';
import { Inventory } from '../entities/inventory.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Order } from '../entities/order.entity';
import { Payment } from '../entities/payment.entity';
import { User } from '../entities/user.entity';
import { VendorOrder } from '../entities/vendor-order.entity';
import { VendorsService } from '../vendors/vendors.service';
import { PaginatedResult, paginate } from '../common/dto/paginated-result';
import { CheckoutDto } from './dto/checkout.dto';
import { OrdersQueryDto, VendorOrdersQueryDto } from './dto/orders-query.dto';
import { UpdateVendorOrderStatusDto } from './dto/update-vendor-order-status.dto';
import { StripeService } from './stripe.service';

const ORDER_RELATIONS = [
  'user',
  'vendorOrders',
  'vendorOrders.store',
  'vendorOrders.items',
  'vendorOrders.items.variant',
  'payments',
];

@Injectable()
export class OrdersService {
  private readonly logger = new Logger('OrdersService');

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(VendorOrder)
    private readonly vendorOrdersRepository: Repository<VendorOrder>,
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    private readonly addressesService: AddressesService,
    private readonly vendorsService: VendorsService,
    private readonly stripeService: StripeService,
  ) {}

  // ------------------------------------------------------------ checkout

  /**
   * Steps 1–13 of the required checkout flow all happen inside ONE
   * transaction: load cart → validate every item (status, stock) → compute
   * prices server-side → group by vendor → create Order/VendorOrder/
   * OrderItem → reserve stock. If anything fails, the whole transaction
   * rolls back and nothing is left half-created. Steps 14–15 (Stripe session
   * + Payment row) happen after commit, since they call an external API that
   * shouldn't hold a DB transaction open. The cart itself is NOT cleared
   * here — see handleCheckoutSessionCompleted() for why.
   *
   * If the Stripe call itself fails (confirmed in integration testing with
   * a placeholder API key — the original version of this method left a
   * permanently "pending" Order behind, holding reserved stock forever with
   * no stripeSessionId to ever retry against), `cancelUnpaidOrder` runs as a
   * compensating transaction: the order and stock reservation it created
   * are rolled back, and the failure is surfaced as a clean error rather
   * than a silent zombie order.
   */
  async checkout(user: User, dto: CheckoutDto): Promise<{ order: Order; checkoutUrl: string }> {
    const address = await this.addressesService.findOwnedOrThrow(user.id, dto.addressId);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let savedOrder: Order;
    let checkoutLineItems: { name: string; quantity: number; unitAmountCents: number; imageUrl?: string }[] = [];
    try {
      const cart = await queryRunner.manager.findOne(Cart, {
        where: { user: { id: user.id } },
        relations: [
          'items',
          'items.variant',
          'items.variant.product',
          'items.variant.product.store',
          'items.variant.product.images',
          'items.variant.inventory',
        ],
      });

      const selectedItems = (cart?.items ?? []).filter((item) => item.selectedForPurchase);
      if (selectedItems.length === 0) {
        throw new BadRequestException('No items selected for checkout');
      }

      // ---- validate every line item against LIVE database state ----
      for (const item of selectedItems) {
        const { variant } = item;
        if (variant.product.status !== ProductStatus.ACTIVE) {
          throw new ConflictException(`"${variant.product.name}" is no longer available`);
        }
        const available =
          (variant.inventory?.stockQuantity ?? 0) - (variant.inventory?.reservedQuantity ?? 0);
        if (item.quantity > available) {
          throw new ConflictException(
            `Only ${Math.max(available, 0)} unit(s) of "${variant.product.name}" are available`,
          );
        }
      }

      // ---- group by store, pricing computed server-side only ----
      const groups = new Map<string, CartItem[]>();
      for (const item of selectedItems) {
        const storeId = item.variant.product.store.id;
        if (!groups.has(storeId)) groups.set(storeId, []);
        groups.get(storeId)!.push(item);
      }

      let orderSubtotal = 0;
      const vendorOrderPlans = Array.from(groups.entries()).map(([storeId, items]) => {
        const store = items[0].variant.product.store;
        const lines = items.map((item) => {
          const unitPrice = Number(item.variant.discountPrice ?? item.variant.price);
          return { item, unitPrice, lineTotal: unitPrice * item.quantity };
        });
        const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
        orderSubtotal += subtotal;
        return { storeId, store, lines, subtotal };
      });

      // One real Stripe line item per product variant — shown on Stripe's
      // hosted checkout page — instead of a single opaque "Order X" line,
      // so a buyer can actually see what they're paying for before paying.
      checkoutLineItems = vendorOrderPlans.flatMap((plan) =>
        plan.lines.map((line) => {
          const { product } = line.item.variant;
          const attributes = line.item.variant.attributes;
          const attributeText = attributes
            ? Object.entries(attributes)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ')
            : '';
          return {
            name: attributeText ? `${product.name} (${attributeText})` : product.name,
            quantity: line.item.quantity,
            unitAmountCents: Math.round(line.unitPrice * 100),
            imageUrl: product.images?.[0]?.url,
          };
        }),
      );

      // Shipping/tax/commission calculation is out of scope for this pass —
      // flat zero, structurally ready for real logic (a shipping-rate table,
      // a tax service, the Commission entity) to plug in later without an
      // Order/VendorOrder schema change.
      const shippingTotal = 0;
      const taxTotal = 0;
      const discountTotal = 0;
      const orderTotal = orderSubtotal + shippingTotal + taxTotal - discountTotal;

      const order = queryRunner.manager.create(Order, {
        orderNumber: this.generateOrderNumber(),
        user,
        shippingAddress: address,
        shippingName: `${user.firstName} ${user.lastName}`,
        shippingPhone: dto.contactPhone,
        shippingStreetAddress: address.streetAddress,
        shippingCity: address.city,
        shippingArea: address.area,
        shippingCountry: address.country,
        shippingPostalCode: address.postalCode,
        status: OrderStatus.PENDING,
        paymentStatus: OrderPaymentStatus.PENDING,
        paymentMethod: dto.paymentMethod,
        subtotal: orderSubtotal.toFixed(2),
        shippingTotal: shippingTotal.toFixed(2),
        taxTotal: taxTotal.toFixed(2),
        discountTotal: discountTotal.toFixed(2),
        total: orderTotal.toFixed(2),
        currency: 'USD',
      });
      savedOrder = await queryRunner.manager.save(order);

      for (const plan of vendorOrderPlans) {
        const vendorOrder = queryRunner.manager.create(VendorOrder, {
          order: savedOrder,
          store: plan.store,
          status: VendorOrderStatus.PROCESSING,
          subtotal: plan.subtotal.toFixed(2),
          shippingFee: '0.00',
          commissionRateSnapshot: '0.00',
          commissionAmount: '0.00',
          total: plan.subtotal.toFixed(2),
        });
        const savedVendorOrder = await queryRunner.manager.save(vendorOrder);

        for (const line of plan.lines) {
          const orderItem = queryRunner.manager.create(OrderItem, {
            vendorOrder: savedVendorOrder,
            variant: line.item.variant,
            quantity: line.item.quantity,
            unitPrice: line.unitPrice.toFixed(2),
            total: line.lineTotal.toFixed(2),
            productNameSnapshot: line.item.variant.product.name,
            skuSnapshot: line.item.variant.sku,
            variantAttributesSnapshot: line.item.variant.attributes,
            imageUrlSnapshot: line.item.variant.product.images?.[0]?.url ?? null,
          });
          await queryRunner.manager.save(orderItem);

          // Reserve stock — committed to a real decrement only once the
          // webhook confirms payment; released if payment fails/expires.
          await queryRunner.manager.increment(
            Inventory,
            { variant: { id: line.item.variant.id } },
            'reservedQuantity',
            line.item.quantity,
          );
        }
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    // Deliberately OUTSIDE the DB transaction above (an external API call
    // must never hold a DB transaction open) — but a failure here still
    // needs its own cleanup, or the order+reservation just committed above
    // becomes permanent with no way to ever complete or retry it.
    try {
      const session = await this.stripeService.createCheckoutSession({
        orderId: savedOrder.id,
        orderNumber: savedOrder.orderNumber,
        currency: savedOrder.currency,
        customerEmail: user.email,
        lineItems: checkoutLineItems,
      });

      savedOrder.stripeSessionId = session.id;
      await this.ordersRepository.save(savedOrder);

      await this.paymentsRepository.save(
        this.paymentsRepository.create({
          order: savedOrder,
          type: PaymentType.CHARGE,
          provider: 'stripe',
          providerRef: session.id,
          amount: savedOrder.total,
          currency: savedOrder.currency,
          status: PaymentStatus.PENDING,
        }),
      );

      return { order: savedOrder, checkoutUrl: session.url ?? '' };
    } catch (error) {
      this.logger.error(
        `Stripe session creation failed for order ${savedOrder.id} — cancelling and releasing reserved stock`,
        error,
      );
      await this.cancelUnpaidOrder(savedOrder.id);
      throw new ServiceUnavailableException(
        'Unable to start payment right now. Your order was not placed — please try checking out again.',
      );
    }
  }

  /** Compensating transaction for a checkout that got as far as reserving
   * stock but never obtained a payment session (Stripe failure, timeout,
   * etc). Cancels the order and gives every unit back to the shared pool —
   * without this, a transient Stripe outage would permanently lock
   * inventory that no customer could ever actually buy. */
  private async cancelUnpaidOrder(orderId: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const order = await queryRunner.manager.findOneOrFail(Order, {
        where: { id: orderId },
        relations: ['vendorOrders', 'vendorOrders.items', 'vendorOrders.items.variant'],
      });

      order.status = OrderStatus.CANCELLED;
      order.paymentStatus = OrderPaymentStatus.FAILED;
      await queryRunner.manager.save(order);

      for (const vendorOrder of order.vendorOrders) {
        for (const item of vendorOrder.items) {
          if (!item.variant) continue;
          await queryRunner.manager.decrement(
            Inventory,
            { variant: { id: item.variant.id } },
            'reservedQuantity',
            item.quantity,
          );
        }
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      // Don't let a cleanup failure mask the original Stripe error — log
      // loudly so it can be reconciled manually, since this is now a real
      // stuck reservation that needs operator attention.
      this.logger.error(`Failed to cancel/release order ${orderId} after checkout failure`, error);
    } finally {
      await queryRunner.release();
    }
  }

  // --------------------------------------------------------- webhook

  /**
   * The ONLY code path allowed to mark an order paid. Idempotent by
   * construction: Payment.(provider, providerRef) is unique, so if Stripe
   * redelivers this event, the lookup below finds the already-SUCCEEDED
   * Payment row and returns without reprocessing — inventory is never
   * double-decremented and the cart is never double-cleared.
   */
  async handleCheckoutSessionCompleted(stripeSessionId: string): Promise<void> {
    const payment = await this.paymentsRepository.findOne({
      where: { providerRef: stripeSessionId, provider: 'stripe' },
      relations: ['order'],
    });
    if (!payment) {
      this.logger.warn(`Webhook for unknown Stripe session ${stripeSessionId}`);
      return;
    }
    if (payment.status === PaymentStatus.SUCCEEDED) {
      return; // already processed — redelivered event, safe no-op
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const order = await queryRunner.manager.findOneOrFail(Order, {
        where: { id: payment.order.id },
        relations: ORDER_RELATIONS,
      });

      order.paymentStatus = OrderPaymentStatus.PAID;
      order.status = OrderStatus.CONFIRMED;
      await queryRunner.manager.save(order);

      payment.status = PaymentStatus.SUCCEEDED;
      payment.succeededAt = new Date();
      await queryRunner.manager.save(payment);

      // TypeORM's delete()/update() criteria objects only resolve ONE level
      // of relation nesting (`cart: { id }` works; `cart: { user: { id } }`
      // throws "Cannot find alias for relation at cart" — confirmed in
      // integration testing). Resolving the cart id once up front avoids
      // that entirely.
      const cart = await queryRunner.manager.findOne(Cart, {
        where: { user: { id: order.user.id } },
      });

      const orderItems = order.vendorOrders.flatMap((vo) => vo.items);
      for (const item of orderItems) {
        if (!item.variant) continue; // variant may have been deleted since checkout — stock already reserved against it is a no-op to commit
        await queryRunner.manager.decrement(
          Inventory,
          { variant: { id: item.variant.id } },
          'stockQuantity',
          item.quantity,
        );
        await queryRunner.manager.decrement(
          Inventory,
          { variant: { id: item.variant.id } },
          'reservedQuantity',
          item.quantity,
        );

        // Clear the cart ONLY now that payment is confirmed — clearing at
        // checkout-session-creation time would lose the cart if the
        // customer abandons or fails payment on Stripe's page.
        if (cart) {
          await queryRunner.manager.delete(CartItem, {
            cart: { id: cart.id },
            variant: { id: item.variant.id },
          });
        }
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to process payment success for order ${payment.order.id}`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async handleCheckoutSessionFailedOrExpired(stripeSessionId: string): Promise<void> {
    const payment = await this.paymentsRepository.findOne({
      where: { providerRef: stripeSessionId, provider: 'stripe' },
      relations: ['order', 'order.vendorOrders', 'order.vendorOrders.items', 'order.vendorOrders.items.variant'],
    });
    if (!payment || payment.status !== PaymentStatus.PENDING) {
      return; // already resolved or unknown session — safe no-op
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      payment.status = PaymentStatus.FAILED;
      await queryRunner.manager.save(payment);

      payment.order.paymentStatus = OrderPaymentStatus.FAILED;
      payment.order.status = OrderStatus.CANCELLED;
      await queryRunner.manager.save(payment.order);

      // Release the reservation — stock itself was never decremented, so
      // this simply makes the units available to other customers again.
      for (const vendorOrder of payment.order.vendorOrders) {
        for (const item of vendorOrder.items) {
          if (!item.variant) continue;
          await queryRunner.manager.decrement(
            Inventory,
            { variant: { id: item.variant.id } },
            'reservedQuantity',
            item.quantity,
          );
        }
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ------------------------------------------------------------- reads

  async findMine(user: User, query: OrdersQueryDto): Promise<PaginatedResult<Order>> {
    const qb = this.ordersRepository
      .createQueryBuilder('order')
      .where('order.user = :userId', { userId: user.id })
      .orderBy('order.createdAt', 'DESC')
      .skip(query.skip)
      .take(query.limit);

    if (query.status) qb.andWhere('order.status = :status', { status: query.status });
    if (query.paymentStatus) {
      qb.andWhere('order.paymentStatus = :paymentStatus', { paymentStatus: query.paymentStatus });
    }

    const [rows, total] = await qb.getManyAndCount();
    const ids = rows.map((r) => r.id);
    const data = await this.hydrateOrdered(ids);
    return paginate(data, total, query.page, query.limit);
  }

  async findMineById(user: User, id: string): Promise<Order> {
    const order = await this.ordersRepository.findOne({ where: { id }, relations: ORDER_RELATIONS });
    if (!order || order.user?.id !== user.id) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async adminFindAll(query: OrdersQueryDto): Promise<PaginatedResult<Order>> {
    const qb = this.ordersRepository
      .createQueryBuilder('order')
      .orderBy('order.createdAt', 'DESC')
      .skip(query.skip)
      .take(query.limit);

    if (query.status) qb.andWhere('order.status = :status', { status: query.status });
    if (query.paymentStatus) {
      qb.andWhere('order.paymentStatus = :paymentStatus', { paymentStatus: query.paymentStatus });
    }

    const [rows, total] = await qb.getManyAndCount();
    const ids = rows.map((r) => r.id);
    const data = await this.hydrateOrdered(ids, ['user']);
    return paginate(data, total, query.page, query.limit);
  }

  async adminFindOne(id: string): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: ORDER_RELATIONS,
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  // ---------------------------------------------------------- vendor side

  async findVendorOrders(user: User, query: VendorOrdersQueryDto): Promise<PaginatedResult<VendorOrder>> {
    const vendor = await this.vendorsService.findMine(user.id);
    const store = await this.vendorsService.getStoreForVendor(vendor.id);

    const qb = this.vendorOrdersRepository
      .createQueryBuilder('vendorOrder')
      .leftJoinAndSelect('vendorOrder.items', 'items')
      .leftJoinAndSelect('vendorOrder.order', 'order')
      .where('vendorOrder.store = :storeId', { storeId: store.id })
      .orderBy('vendorOrder.createdAt', 'DESC')
      .skip(query.skip)
      .take(query.limit);

    if (query.status) qb.andWhere('vendorOrder.status = :status', { status: query.status });

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, query.page, query.limit);
  }

  async findVendorOrderById(user: User, id: string): Promise<VendorOrder> {
    const vendorOrder = await this.vendorOrdersRepository.findOne({
      where: { id },
      relations: ['items', 'order', 'store', 'store.vendor', 'store.vendor.user'],
    });
    if (!vendorOrder) {
      throw new NotFoundException('Order not found');
    }
    if (vendorOrder.store.vendor.user.id !== user.id) {
      throw new ForbiddenException('You do not have access to this order');
    }
    return vendorOrder;
  }

  async updateVendorOrderStatus(
    user: User,
    id: string,
    dto: UpdateVendorOrderStatusDto,
  ): Promise<VendorOrder> {
    const vendorOrder = await this.findVendorOrderById(user, id);

    vendorOrder.status = dto.status;
    if (dto.trackingNumber !== undefined) vendorOrder.trackingNumber = dto.trackingNumber;
    if (dto.trackingCarrier !== undefined) vendorOrder.trackingCarrier = dto.trackingCarrier;
    if (dto.status === VendorOrderStatus.SHIPPED && !vendorOrder.shippedAt) {
      vendorOrder.shippedAt = new Date();
    }
    if (dto.status === VendorOrderStatus.DELIVERED && !vendorOrder.deliveredAt) {
      vendorOrder.deliveredAt = new Date();
    }

    return this.vendorOrdersRepository.save(vendorOrder);
  }

  // ------------------------------------------------------------- helpers

  private async hydrateOrdered(ids: string[], extraRelations: string[] = []): Promise<Order[]> {
    if (ids.length === 0) return [];
    const orders = await this.ordersRepository.find({
      where: { id: In(ids) },
      relations: [...ORDER_RELATIONS, ...extraRelations],
    });
    const byId = new Map(orders.map((o) => [o.id, o]));
    return ids.map((id) => byId.get(id)).filter((o): o is Order => !!o);
  }

  private generateOrderNumber(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(100000 + Math.random() * 900000);
    return `ORD-${year}-${random}`;
  }
}
