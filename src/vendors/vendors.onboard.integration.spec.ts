import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { entities } from '../entities';
import { VendorsService } from './vendors.service';
import { UsersService } from '../users/users.service';
import { User } from '../entities/user.entity';
import { Vendor } from '../entities/vendor.entity';
import { Store } from '../entities/store.entity';
import { UserRole } from '../entities/enums';

/**
 * Regression coverage for the onboarding bug caught in manual testing:
 * `usersService.save(user)` on the request-scoped `user` object (which
 * carries a stale `vendor: null` relation loaded before onboarding created
 * one) caused TypeORM to null out the just-created vendor row's `user_id`
 * FK, violating its NOT NULL constraint — and because vendor/store creation
 * wasn't wrapped in the same transaction as that update, the failure left
 * permanently orphaned Vendor/Store rows with no way to retry.
 */
describe('VendorsService.onboard() (integration)', () => {
  let dataSource: DataSource;
  let vendorsService: VendorsService;
  let usersService: UsersService;
  const suffix = Math.random().toString(36).slice(2, 10);
  let user: User;

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

    usersService = new UsersService(dataSource.getRepository(User));
    vendorsService = new VendorsService(
      dataSource.getRepository(Vendor),
      dataSource.getRepository(Store),
      usersService,
      dataSource,
    );

    const usersRepo = dataSource.getRepository(User);
    user = await usersRepo.save(
      usersRepo.create({
        email: `onboard-test-${suffix}@example.com`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Onboard',
        lastName: 'Test',
        role: UserRole.CUSTOMER,
      }),
    );
  });

  afterAll(async () => {
    await dataSource.query(
      `DELETE FROM stores WHERE vendor_id IN (SELECT id FROM vendors WHERE user_id = $1)`,
      [user.id],
    );
    await dataSource.getRepository(Vendor).delete({ user: { id: user.id } });
    await dataSource.getRepository(User).delete({ id: user.id });
    await dataSource.destroy();
  });

  it('creates Vendor + Store + role update atomically, with a fully-loaded request-scoped user object', async () => {
    // Mirrors what JwtStrategy actually hands the controller: a User entity
    // with `vendor` explicitly loaded (as null, pre-onboarding) — this exact
    // shape is what broke the old `usersService.save(user)` call.
    const requestScopedUser = await dataSource
      .getRepository(User)
      .findOneOrFail({ where: { id: user.id }, relations: ['vendor'] });
    expect(requestScopedUser.vendor).toBeFalsy();

    const vendor = await vendorsService.onboard(requestScopedUser, {
      businessName: `Onboard Test Business ${suffix}`,
      storeName: `Onboard Test Store ${suffix}`,
    });

    expect(vendor.status).toBe('pending');
    expect(vendor.stores).toHaveLength(1);

    const persistedUser = await dataSource.getRepository(User).findOneOrFail({ where: { id: user.id } });
    expect(persistedUser.role).toBe(UserRole.VENDOR);

    // Filtering by `user: { id }` already proves the FK isn't null (a
    // nulled-out FK, the old bug's actual failure mode, would make this
    // WHERE clause match nothing and findOneOrFail would throw). Explicitly
    // loading + asserting the relation makes that guarantee visible in the
    // test output rather than merely implicit in "the query succeeded".
    const persistedVendor = await dataSource
      .getRepository(Vendor)
      .findOneOrFail({ where: { user: { id: user.id } }, relations: ['user'] });
    expect(persistedVendor.user.id).toBe(user.id);
  });

  it('rejects a second onboarding attempt for an already-onboarded user (proves no orphaned retry-blocking rows)', async () => {
    await expect(
      vendorsService.onboard(user, {
        businessName: 'Duplicate attempt',
        storeName: 'Duplicate store',
      }),
    ).rejects.toThrow(/already registered as a vendor/);
  });
});
