import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { slugify } from '../common/utils/slugify';
import { PaginatedResult, paginate } from '../common/dto/paginated-result';
import { StoreStatus, UserRole, VendorStatus } from '../entities/enums';
import { Store } from '../entities/store.entity';
import { User } from '../entities/user.entity';
import { Vendor } from '../entities/vendor.entity';
import { UsersService } from '../users/users.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { VendorsQueryDto } from './dto/vendors-query.dto';

@Injectable()
export class VendorsService {
  constructor(
    @InjectRepository(Vendor)
    private readonly vendorsRepository: Repository<Vendor>,
    @InjectRepository(Store)
    private readonly storesRepository: Repository<Store>,
    private readonly usersService: UsersService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Vendor + Store + role-change all happen in ONE transaction. Caught in
   * integration testing: an earlier version saved each independently, and
   * when the final role-update step failed, the already-committed Vendor
   * and Store rows were left orphaned (pending forever, no way to retry
   * onboarding since the uniqueness check would find them). Wrapping this
   * in a real transaction means "onboard" is now genuinely all-or-nothing.
   */
  async onboard(user: User, dto: CreateVendorDto): Promise<Vendor> {
    const existing = await this.vendorsRepository.findOne({ where: { user: { id: user.id } } });
    if (existing) {
      throw new ConflictException('This account is already registered as a vendor');
    }

    const slug = await this.uniqueSlug(dto.storeSlug ?? dto.storeName);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const vendor = queryRunner.manager.create(Vendor, {
        user: { id: user.id },
        status: VendorStatus.PENDING,
        businessName: dto.businessName,
        taxId: dto.taxId ?? null,
      });
      const savedVendor = await queryRunner.manager.save(vendor);

      const store = queryRunner.manager.create(Store, {
        vendor: savedVendor,
        name: dto.storeName,
        slug,
        description: dto.description ?? null,
        logoUrl: dto.logoUrl ?? null,
        bannerUrl: dto.bannerUrl ?? null,
        contactEmail: dto.contactEmail ?? null,
        contactPhone: dto.contactPhone ?? null,
        status: StoreStatus.PENDING,
      });
      await queryRunner.manager.save(store);

      // Role reflects "this account operates as a vendor" from the moment
      // they apply — actual vendor PRIVILEGES still gate on Vendor.status
      // === APPROVED (see VendorApprovedGuard), so a pending applicant can
      // see their own dashboard/status but can't create products yet.
      // A targeted update on the User row (not a full-entity save of the
      // request-scoped `user` object) — that object carries a `vendor: null`
      // relation loaded before this method ran, and TypeORM's save() would
      // re-sync that stale relation, nulling the FK we just set.
      await queryRunner.manager.update(User, user.id, { role: UserRole.VENDOR });

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    return this.findByUserIdOrThrow(user.id);
  }

  async findMine(userId: string): Promise<Vendor> {
    return this.findByUserIdOrThrow(userId);
  }

  async updateMyStore(userId: string, dto: UpdateStoreDto): Promise<Store> {
    const vendor = await this.findByUserIdOrThrow(userId);
    const store = await this.getStoreForVendor(vendor.id);

    if (dto.name && dto.name !== store.name) {
      store.name = dto.name;
    }
    if (dto.description !== undefined) store.description = dto.description;
    if (dto.logoUrl !== undefined) store.logoUrl = dto.logoUrl;
    if (dto.bannerUrl !== undefined) store.bannerUrl = dto.bannerUrl;
    if (dto.contactEmail !== undefined) store.contactEmail = dto.contactEmail;
    if (dto.contactPhone !== undefined) store.contactPhone = dto.contactPhone;

    return this.storesRepository.save(store);
  }

  async findPublicById(id: string): Promise<Vendor> {
    const vendor = await this.vendorsRepository.findOne({
      where: { id },
      relations: ['stores'],
    });
    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }
    return vendor;
  }

  async adminList(query: VendorsQueryDto): Promise<PaginatedResult<Vendor>> {
    const qb = this.vendorsRepository
      .createQueryBuilder('vendor')
      .leftJoinAndSelect('vendor.user', 'user')
      .leftJoinAndSelect('vendor.stores', 'store')
      .orderBy('vendor.createdAt', 'DESC')
      .skip(query.skip)
      .take(query.limit);

    if (query.status) {
      qb.andWhere('vendor.status = :status', { status: query.status });
    }

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, query.page, query.limit);
  }

  async adminUpdateStatus(vendorId: string, status: VendorStatus): Promise<Vendor> {
    const vendor = await this.vendorsRepository.findOne({
      where: { id: vendorId },
      relations: ['stores'],
    });
    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    // Keep Store.status in lockstep — v1's one-store-per-vendor rule means
    // there is exactly one store to update. See Store entity for why the two
    // statuses are modeled separately even though they move together today.
    // Both writes in one transaction so a mid-way failure can never leave
    // Vendor and Store status out of sync.
    const storeStatus = this.storeStatusFor(status);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.manager.update(Vendor, vendorId, { status });
      await queryRunner.manager.update(Store, { vendor: { id: vendorId } }, { status: storeStatus });
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    // Re-fetch rather than mutate-and-return the pre-transaction object —
    // caught in integration testing: returning the stale in-memory `vendor`
    // (with `vendor.status` patched by hand but `vendor.stores[0].status`
    // never touched) reported "pending" back to the caller for a store the
    // transaction above had actually just set to "active" in the database.
    // The write was always correct; only the response echoed stale data.
    return this.vendorsRepository.findOneOrFail({
      where: { id: vendorId },
      relations: ['stores'],
    });
  }

  /** Used by other modules (Products, VendorOrders) to enforce "a vendor
   * must never touch another vendor's resources." Throws rather than
   * returning a boolean so callers can't accidentally forget to check it. */
  async assertOwnsStore(user: User, storeId: string): Promise<Store> {
    const store = await this.storesRepository.findOne({
      where: { id: storeId },
      relations: ['vendor', 'vendor.user'],
    });
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    if (store.vendor.user.id !== user.id) {
      throw new ForbiddenException('You do not have access to this store');
    }
    return store;
  }

  async getStoreForVendor(vendorId: string): Promise<Store> {
    const store = await this.storesRepository.findOne({ where: { vendor: { id: vendorId } } });
    if (!store) {
      throw new NotFoundException('Store not found for this vendor');
    }
    return store;
  }

  private async findByUserIdOrThrow(userId: string): Promise<Vendor> {
    const vendor = await this.vendorsRepository.findOne({
      where: { user: { id: userId } },
      relations: ['stores', 'user'],
    });
    if (!vendor) {
      throw new NotFoundException('No vendor profile found for this account');
    }
    return vendor;
  }

  private storeStatusFor(vendorStatus: VendorStatus): StoreStatus {
    switch (vendorStatus) {
      case VendorStatus.APPROVED:
        return StoreStatus.ACTIVE;
      case VendorStatus.REJECTED:
        return StoreStatus.REJECTED;
      case VendorStatus.SUSPENDED:
        return StoreStatus.SUSPENDED;
      case VendorStatus.PENDING:
      default:
        return StoreStatus.PENDING;
    }
  }

  private async uniqueSlug(source: string): Promise<string> {
    const base = slugify(source);
    let candidate = base || 'store';
    let suffix = 1;
    while (await this.storesRepository.exist({ where: { slug: candidate } })) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    return candidate;
  }
}
