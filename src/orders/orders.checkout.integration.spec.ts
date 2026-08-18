import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { ConflictException } from '@nestjs/common';
import { entities } from '../entities';
import { OrdersService } from './orders.service';
import { VendorsService } from '../vendors/vendors.service';
import { AddressesService } from '../addresses/addresses.service';
import { StripeService } from './stripe.service';
import { User } from '../entities/user.entity';
import { Vendor } from '../entities/vendor.entity';
import { Store } from '../entities/store.entity';
import { Category } from '../entities/category.entity';
import { Product } from '../entities/product.entity';
import { ProductVariant } from '../entities/product-variant.entity';
import { Inventory } from '../entities/inventory.entity';
import { Address } from '../entities/address.entity';
import { Cart } from '../entities/cart.entity';
import { CartItem } from '../entities/cart-item.entity';
import { Order } from '../entities/order.entity';
import { VendorOrder } from '../entities/vendor-order.entity';
import { Payment } from '../entities/payment.entity';
import { ProductStatus, StoreStatus, UserRole, VendorStatus, PaymentStatus } from '../entities/enums';

/**
 * Real integration tests against a real Postgres connection — these are the
 * regression coverage for five genuine bugs caught only by hitting the
 * actual database during manual testing (never by `tsc` or a mocked unit
 * test): stale-relation full-entity saves, missing `vendorOrders.items.
 * variant`/`order.user` in ORDER_RELATIONS, TypeORM's one-level relation
 * limit on delete() criteria, non-atomic vendor onboarding, and no
 * compensating action when the post-commit Stripe call fails.
 *
 * Requires a reachable Postgres matching .env (DATABASE_HOST/PORT/etc) with
 * migrations already applied. Bypasses Nest's DI container deliberately —
 * OrdersService is instantiated directly with real repositories so these
 * tests exercise real TypeORM query generation, not a mocked stand-in.
 */
describe('OrdersService — checkout & webhook (integration)', () => {
  let dataSource: DataSource;
  let ordersService: OrdersService;
  let stripeService: { createCheckoutSession: jest.Mock; constructWebhookEvent: jest.Mock };

  let user: User;
  let vendorA: Vendor;
  let storeA: Store;
  let category: Category;
  let variant: ProductVariant;
  let address: Address;

  const suffix = Math.random().toString(36).slice(2, 10);

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DATABASE_HOST ?? 'localhost',
      port: Number(process.env.DATABASE_PORT ?? 5432),
      username: process.env.DATABASE_USERNAME ?? 'postgres',
      password: process.env.DATABASE_PASSWORD ?? 'postgres',
      database: process.env.DATABASE_NAME ?? 'eshop_marketplace',
      namingStrategy: new SnakeNamingStrategy(),
      entities,
      synchronize: false,
    });
    await dataSource.initialize();

    // ---- minimal fixtures: one vendor, one product, one address ----
    const usersRepo = dataSource.getRepository(User);
    user = await usersRepo.save(
      usersRepo.create({
        email: `checkout-test-${suffix}@example.com`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Buyer',
        role: UserRole.CUSTOMER,
      }),
    );

    const vendorsRepo = dataSource.getRepository(Vendor);
    vendorA = await vendorsRepo.save(
      vendorsRepo.create({
        user,
        status: VendorStatus.APPROVED,
        businessName: `Test Vendor ${suffix}`,
      }),
    );

    const storesRepo = dataSource.getRepository(Store);
    storeA = await storesRepo.save(
      storesRepo.create({
        vendor: vendorA,
        name: `Test Store ${suffix}`,
        slug: `test-store-${suffix}`,
        status: StoreStatus.ACTIVE,
      }),
    );

    const categoriesRepo = dataSource.getRepository(Category);
    category = await categoriesRepo.save(
      categoriesRepo.create({ name: `Test Category ${suffix}`, slug: `test-category-${suffix}` }),
    );

    const productsRepo = dataSource.getRepository(Product);
    const product = await productsRepo.save(
      productsRepo.create({
        store: storeA,
        category,
        name: `Integration Test Widget ${suffix}`,
        slug: `integration-test-widget-${suffix}`,
        status: ProductStatus.ACTIVE,
      }),
    );

    const variantsRepo = dataSource.getRepository(ProductVariant);
    variant = await variantsRepo.save(
      variantsRepo.create({ product, sku: `WIDGET-${suffix}`, price: '10.00' }),
    );

    const inventoryRepo = dataSource.getRepository(Inventory);
    await inventoryRepo.save(
      inventoryRepo.create({ variant, stockQuantity: 5, reservedQuantity: 0 }),
    );

    const addressesRepo = dataSource.getRepository(Address);
    address = await addressesRepo.save(
      addressesRepo.create({
        user,
        streetAddress: '1 Test St',
        city: 'Testville',
        area: 'Central',
        country: 'Testland',
        postalCode: '00000',
      }),
    );

    const cartsRepo = dataSource.getRepository(Cart);
    await cartsRepo.save(cartsRepo.create({ user }));
  });

  afterAll(async () => {
    // Children first (FK order) — RESTRICT/CASCADE means order matters here.
    // Scoped to this test run's own orders only — never an unscoped delete
    // against a table shared with real data.
    await dataSource.query(`DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)`, [
      user.id,
    ]);
    await dataSource.query(
      `DELETE FROM order_items WHERE variant_id = $1`,
      [variant.id],
    );
    await dataSource.query(`DELETE FROM vendor_orders WHERE store_id = $1`, [storeA.id]);
    await dataSource.query(`DELETE FROM orders WHERE user_id = $1`, [user.id]);
    await dataSource.getRepository(CartItem).delete({ variant: { id: variant.id } });
    await dataSource.getRepository(Cart).delete({ user: { id: user.id } });
    await dataSource.getRepository(Address).delete({ user: { id: user.id } });
    await dataSource.getRepository(Inventory).delete({ variant: { id: variant.id } });
    await dataSource.getRepository(ProductVariant).delete({ id: variant.id });
    await dataSource.query(`DELETE FROM products WHERE store_id = $1`, [storeA.id]);
    await dataSource.getRepository(Store).delete({ id: storeA.id });
    await dataSource.getRepository(Vendor).delete({ id: vendorA.id });
    await dataSource.getRepository(Category).delete({ id: category.id });
    await dataSource.getRepository(User).delete({ id: user.id });
    await dataSource.destroy();
  });

  beforeEach(() => {
    stripeService = {
      createCheckoutSession: jest.fn(),
      constructWebhookEvent: jest.fn(),
    };

    const vendorsService = new VendorsService(
      dataSource.getRepository(Vendor),
      dataSource.getRepository(Store),
      undefined as any, // UsersService — unused by the paths under test
      dataSource,
    );
    const addressesService = new AddressesService(dataSource.getRepository(Address));

    ordersService = new OrdersService(
      dataSource,
      dataSource.getRepository(Order),
      dataSource.getRepository(VendorOrder),
      dataSource.getRepository(Payment),
      addressesService,
      vendorsService,
      stripeService as unknown as StripeService,
    );
  });

  afterEach(async () => {
    // Reset cart + inventory to a known state between tests.
    await dataSource.getRepository(CartItem).delete({ variant: { id: variant.id } });
    await dataSource
      .getRepository(Inventory)
      .update({ variant: { id: variant.id } }, { stockQuantity: 5, reservedQuantity: 0 });
  });

  async function addToCart(quantity: number) {
    const cart = await dataSource.getRepository(Cart).findOneOrFail({ where: { user: { id: user.id } } });
    const cartItemsRepo = dataSource.getRepository(CartItem);
    await cartItemsRepo.save(cartItemsRepo.create({ cart, variant, quantity, selectedForPurchase: true }));
  }

  describe('checkout()', () => {
    it('computes totals server-side and reserves stock — never trusts a client-supplied price', async () => {
      await addToCart(2);
      stripeService.createCheckoutSession.mockResolvedValue({
        id: `cs_test_${suffix}_1`,
        url: 'https://checkout.stripe.com/test',
      });

      const { order } = await ordersService.checkout(user, {
        addressId: address.id,
        contactPhone: '000',
        paymentMethod: 'card' as any,
      });

      expect(order.subtotal).toBe('20.00'); // 2 × $10.00 — computed from the live variant, not the request
      expect(order.total).toBe('20.00');

      const inventory = await dataSource
        .getRepository(Inventory)
        .findOneOrFail({ where: { variant: { id: variant.id } } });
      expect(inventory.stockQuantity).toBe(5); // not decremented yet — only reserved
      expect(inventory.reservedQuantity).toBe(2);
    });

    it('rolls back the whole transaction and never reserves stock when the cart is empty', async () => {
      await expect(
        ordersService.checkout(user, {
          addressId: address.id,
          contactPhone: '000',
          paymentMethod: 'card' as any,
        }),
      ).rejects.toThrow();

      const inventory = await dataSource
        .getRepository(Inventory)
        .findOneOrFail({ where: { variant: { id: variant.id } } });
      expect(inventory.reservedQuantity).toBe(0);
    });

    it('regression: compensates when the post-commit Stripe call fails — order is cancelled, stock is released, no orphaned payment', async () => {
      await addToCart(3);
      stripeService.createCheckoutSession.mockRejectedValue(new Error('simulated Stripe outage'));

      await expect(
        ordersService.checkout(user, {
          addressId: address.id,
          contactPhone: '000',
          paymentMethod: 'card' as any,
        }),
      ).rejects.toThrow(/Unable to start payment/);

      const orders = await dataSource
        .getRepository(Order)
        .find({ where: { user: { id: user.id } }, order: { createdAt: 'DESC' }, take: 1 });
      expect(orders[0].status).toBe('cancelled');
      expect(orders[0].paymentStatus).toBe('failed');

      const inventory = await dataSource
        .getRepository(Inventory)
        .findOneOrFail({ where: { variant: { id: variant.id } } });
      expect(inventory.reservedQuantity).toBe(0); // released, not left dangling

      const payments = await dataSource.getRepository(Payment).find({ where: { order: { id: orders[0].id } } });
      expect(payments).toHaveLength(0); // never got far enough to create one — no partial record
    });
  });

  describe('handleCheckoutSessionCompleted() — regression coverage', () => {
    it('loads vendorOrders.items.variant and order.user correctly, decrements stock exactly once, and clears the cart', async () => {
      await addToCart(1);
      const sessionId = `cs_test_${suffix}_2`;
      stripeService.createCheckoutSession.mockResolvedValue({ id: sessionId, url: 'https://checkout.stripe.com/test' });

      await ordersService.checkout(user, {
        addressId: address.id,
        contactPhone: '000',
        paymentMethod: 'card' as any,
      });

      // Would previously throw "Cannot read properties of undefined (reading
      // 'id')" (missing order.user) or silently no-op (missing
      // vendorOrders.items.variant) before the fix.
      await expect(ordersService.handleCheckoutSessionCompleted(sessionId)).resolves.not.toThrow();

      const inventory = await dataSource
        .getRepository(Inventory)
        .findOneOrFail({ where: { variant: { id: variant.id } } });
      expect(inventory.stockQuantity).toBe(4); // 5 - 1, decremented exactly once
      expect(inventory.reservedQuantity).toBe(0);

      const remainingCartItems = await dataSource
        .getRepository(CartItem)
        .find({ where: { variant: { id: variant.id } } });
      expect(remainingCartItems).toHaveLength(0);

      const payment = await dataSource
        .getRepository(Payment)
        .findOneOrFail({ where: { providerRef: sessionId } });
      expect(payment.status).toBe(PaymentStatus.SUCCEEDED);
    });

    it('is idempotent — redelivering the same event does not double-decrement stock or duplicate the payment', async () => {
      await addToCart(1);
      const sessionId = `cs_test_${suffix}_3`;
      stripeService.createCheckoutSession.mockResolvedValue({ id: sessionId, url: 'https://checkout.stripe.com/test' });

      await ordersService.checkout(user, {
        addressId: address.id,
        contactPhone: '000',
        paymentMethod: 'card' as any,
      });

      await ordersService.handleCheckoutSessionCompleted(sessionId);
      await ordersService.handleCheckoutSessionCompleted(sessionId); // redelivered
      await ordersService.handleCheckoutSessionCompleted(sessionId); // redelivered again

      const inventory = await dataSource
        .getRepository(Inventory)
        .findOneOrFail({ where: { variant: { id: variant.id } } });
      expect(inventory.stockQuantity).toBe(4); // still exactly one decrement across 3 deliveries

      const payments = await dataSource.getRepository(Payment).find({ where: { providerRef: sessionId } });
      expect(payments).toHaveLength(1);
    });
  });

  describe('cancelUnpaidOrder() via checkout.session.expired', () => {
    it('releases a dangling reservation without throwing a relation-alias error on cart cleanup', async () => {
      await addToCart(2);
      const sessionId = `cs_test_${suffix}_4`;
      stripeService.createCheckoutSession.mockResolvedValue({ id: sessionId, url: 'https://checkout.stripe.com/test' });

      await ordersService.checkout(user, {
        addressId: address.id,
        contactPhone: '000',
        paymentMethod: 'card' as any,
      });

      // Would previously throw "Cannot find alias for relation at cart" if
      // this code path used the same two-level-deep delete() criteria as
      // the (now-fixed) completed-session handler.
      await expect(
        ordersService.handleCheckoutSessionFailedOrExpired(sessionId),
      ).resolves.not.toThrow();

      const inventory = await dataSource
        .getRepository(Inventory)
        .findOneOrFail({ where: { variant: { id: variant.id } } });
      expect(inventory.reservedQuantity).toBe(0);
      expect(inventory.stockQuantity).toBe(5); // never decremented — payment never succeeded
    });
  });
});
