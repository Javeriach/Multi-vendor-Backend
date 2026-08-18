import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { PaginatedResult, paginate } from '../common/dto/paginated-result';
import { slugify } from '../common/utils/slugify';
import { ProductStatus, StoreStatus } from '../entities/enums';
import { Inventory } from '../entities/inventory.entity';
import { Product } from '../entities/product.entity';
import { ProductImage } from '../entities/product-image.entity';
import { ProductVariant } from '../entities/product-variant.entity';
import { User } from '../entities/user.entity';
import { VendorsService } from '../vendors/vendors.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateVariantDto } from './dto/create-variant.dto';
import { ProductsQueryDto } from './dto/products-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';

const PRODUCT_RELATIONS = ['images', 'variants', 'variants.inventory', 'category', 'store'];

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variantsRepository: Repository<ProductVariant>,
    @InjectRepository(Inventory)
    private readonly inventoryRepository: Repository<Inventory>,
    @InjectRepository(ProductImage)
    private readonly imagesRepository: Repository<ProductImage>,
    private readonly vendorsService: VendorsService,
  ) {}

  // ------------------------------------------------------------- browsing

  /** The public catalog — always forces status=ACTIVE and an active store,
   * regardless of what the caller passes in `query.status`. Replaces the old
   * app's client-side-only filtering entirely: every filter here is a SQL
   * predicate, not a post-fetch JS `.filter()`. */
  async search(query: ProductsQueryDto): Promise<PaginatedResult<Product>> {
    const qb = this.filterQuery(query)
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE })
      .andWhere('store.status = :storeStatus', { storeStatus: StoreStatus.ACTIVE });
    return this.paginateFilterQuery(qb, query);
  }

  async findBySlugPublic(slug: string): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { slug, status: ProductStatus.ACTIVE },
      relations: PRODUCT_RELATIONS,
    });
    if (!product || product.store.status !== StoreStatus.ACTIVE) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async findByIdPublic(id: string): Promise<Product> {
    const product = await this.findOneOrThrow(id);
    if (product.status !== ProductStatus.ACTIVE || product.store.status !== StoreStatus.ACTIVE) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  // ---------------------------------------------------------- vendor CRUD

  async findAllForVendor(user: User, query: ProductsQueryDto): Promise<PaginatedResult<Product>> {
    const vendor = await this.vendorsService.findMine(user.id);
    const store = await this.vendorsService.getStoreForVendor(vendor.id);

    const qb = this.filterQuery(query, { skipStoreFilter: true }).andWhere(
      'product.store = :storeId',
      { storeId: store.id },
    );
    if (query.status) {
      qb.andWhere('product.status = :status', { status: query.status });
    }
    return this.paginateFilterQuery(qb, query);
  }

  async findOneForVendor(user: User, id: string): Promise<Product> {
    const product = await this.findOneOrThrow(id);
    this.assertOwnsProduct(user, product);
    return product;
  }

  async create(user: User, dto: CreateProductDto): Promise<Product> {
    const vendor = await this.vendorsService.findMine(user.id);
    const store = await this.vendorsService.getStoreForVendor(vendor.id);

    const slug = await this.uniqueSlugForStore(store.id, dto.slug ?? dto.name);

    const skus = dto.variants.map((v) => v.sku);
    if (new Set(skus).size !== skus.length) {
      throw new ConflictException('Duplicate SKU within the same product submission');
    }
    for (const sku of skus) {
      if (await this.variantsRepository.exist({ where: { sku } })) {
        throw new ConflictException(`SKU "${sku}" is already in use`);
      }
    }

    const product = this.productsRepository.create({
      store,
      category: { id: dto.categoryId } as any,
      name: dto.name,
      slug,
      description: dto.description ?? null,
      status: ProductStatus.DRAFT,
    });
    const saved = await this.productsRepository.save(product);

    if (dto.imageUrls?.length) {
      const images = dto.imageUrls.map((url, position) =>
        this.imagesRepository.create({ product: saved, url, position }),
      );
      await this.imagesRepository.save(images);
    }

    for (const variantDto of dto.variants) {
      await this.createVariantInternal(saved, variantDto);
    }

    return this.findOneOrThrow(saved.id);
  }

  async update(user: User, id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findOneOrThrow(id);
    this.assertOwnsProduct(user, product);

    if (dto.name !== undefined) product.name = dto.name;
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.categoryId !== undefined) product.category = { id: dto.categoryId } as any;
    if (dto.status !== undefined) product.status = dto.status;
    if (dto.slug !== undefined) {
      product.slug = await this.uniqueSlugForStore(product.store.id, dto.slug, product.id);
    }

    return this.productsRepository.save(product);
  }

  /** Deactivate, not delete — sets status=ARCHIVED and soft-deletes. The row
   * (and every FK pointing at it, including future OrderItems) stays intact;
   * see the Product entity's note on why this is never a hard delete. */
  async remove(user: User, id: string): Promise<void> {
    const product = await this.findOneOrThrow(id);
    this.assertOwnsProduct(user, product);
    product.status = ProductStatus.ARCHIVED;
    await this.productsRepository.save(product);
    await this.productsRepository.softDelete(product.id);
  }

  // ------------------------------------------------------------ variants

  async addVariant(user: User, productId: string, dto: CreateVariantDto): Promise<ProductVariant> {
    const product = await this.findOneOrThrow(productId);
    this.assertOwnsProduct(user, product);
    if (await this.variantsRepository.exist({ where: { sku: dto.sku } })) {
      throw new ConflictException(`SKU "${dto.sku}" is already in use`);
    }
    return this.createVariantInternal(product, dto);
  }

  async updateVariant(
    user: User,
    productId: string,
    variantId: string,
    dto: UpdateVariantDto,
  ): Promise<ProductVariant> {
    const product = await this.findOneOrThrow(productId);
    this.assertOwnsProduct(user, product);

    const variant = await this.variantsRepository.findOne({ where: { id: variantId, product: { id: productId } } });
    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    if (dto.sku !== undefined && dto.sku !== variant.sku) {
      if (await this.variantsRepository.exist({ where: { sku: dto.sku } })) {
        throw new ConflictException(`SKU "${dto.sku}" is already in use`);
      }
      variant.sku = dto.sku;
    }
    if (dto.attributes !== undefined) variant.attributes = dto.attributes;
    if (dto.price !== undefined) variant.price = dto.price.toFixed(2);
    if (dto.discountPrice !== undefined) {
      variant.discountPrice = dto.discountPrice === null ? null : dto.discountPrice.toFixed(2);
    }
    if (
      dto.discountPrice !== undefined &&
      variant.discountPrice !== null &&
      Number(variant.discountPrice) > Number(variant.price)
    ) {
      throw new ConflictException('Discount price cannot exceed the regular price');
    }

    return this.variantsRepository.save(variant);
  }

  async removeVariant(user: User, productId: string, variantId: string): Promise<void> {
    const product = await this.findOneOrThrow(productId);
    this.assertOwnsProduct(user, product);

    const remaining = await this.variantsRepository.count({ where: { product: { id: productId } } });
    if (remaining <= 1) {
      throw new ConflictException('A product must have at least one variant — deactivate the product instead');
    }
    await this.variantsRepository.softDelete(variantId);
  }

  async adjustStock(
    user: User,
    productId: string,
    variantId: string,
    dto: AdjustStockDto,
  ): Promise<Inventory> {
    const product = await this.findOneOrThrow(productId);
    this.assertOwnsProduct(user, product);

    const inventory = await this.inventoryRepository.findOne({
      where: { variant: { id: variantId, product: { id: productId } } },
    });
    if (!inventory) {
      throw new NotFoundException('Inventory record not found for this variant');
    }
    if (dto.stockQuantity < inventory.reservedQuantity) {
      throw new ConflictException(
        `Cannot set stock below the ${inventory.reservedQuantity} units currently reserved by pending orders`,
      );
    }
    inventory.stockQuantity = dto.stockQuantity;
    return this.inventoryRepository.save(inventory);
  }

  // ------------------------------------------------------------- admin

  async adminFindAll(query: ProductsQueryDto): Promise<PaginatedResult<Product>> {
    const qb = this.filterQuery(query);
    if (query.status) {
      qb.andWhere('product.status = :status', { status: query.status });
    }
    return this.paginateFilterQuery(qb, query);
  }

  async adminSetStatus(id: string, status: ProductStatus): Promise<Product> {
    const product = await this.findOneOrThrow(id);
    product.status = status;
    return this.productsRepository.save(product);
  }

  // ------------------------------------------------------------- helpers

  async findOneOrThrow(id: string): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { id },
      relations: [...PRODUCT_RELATIONS, 'store.vendor', 'store.vendor.user'],
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  private assertOwnsProduct(user: User, product: Product): void {
    if (product.store.vendor.user.id !== user.id) {
      throw new ForbiddenException('You do not have access to this product');
    }
  }

  private async createVariantInternal(
    product: Product,
    dto: CreateVariantDto,
  ): Promise<ProductVariant> {
    const variant = this.variantsRepository.create({
      product,
      sku: dto.sku,
      attributes: dto.attributes ?? null,
      price: dto.price.toFixed(2),
      discountPrice: dto.discountPrice !== undefined ? dto.discountPrice.toFixed(2) : null,
    });
    const savedVariant = await this.variantsRepository.save(variant);

    const inventory = this.inventoryRepository.create({
      variant: savedVariant,
      stockQuantity: dto.stockQuantity ?? 0,
      reservedQuantity: 0,
    });
    await this.inventoryRepository.save(inventory);

    return savedVariant;
  }

  /** Slugs are unique per (store, slug), not globally — the same slug can
   * exist under two different stores (see UQ_product_store_slug). Excludes
   * `excludeProductId` so updating a product's other fields without
   * touching its slug doesn't collide with itself. */
  private async uniqueSlugForStore(
    storeId: string,
    source: string,
    excludeProductId?: string,
  ): Promise<string> {
    const base = slugify(source);
    let candidate = base || 'product';
    let suffix = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await this.productsRepository.findOne({
        where: { store: { id: storeId }, slug: candidate },
      });
      if (!existing || existing.id === excludeProductId) {
        return candidate;
      }
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
  }

  /**
   * Deliberately joins ONLY to-one relations (store, category) — never
   * `variants` or `images` (both OneToMany). Joining a to-many relation and
   * then applying SQL LIMIT/OFFSET on the result is a classic correctness
   * bug: a product with 3 variants contributes 3 joined rows, so pagination
   * silently returns wrong page boundaries and `getCount()` over-counts.
   * Variant-price filtering/sorting is done via correlated subqueries
   * instead, which keeps this query at exactly one row per product.
   */
  private filterQuery(
    query: ProductsQueryDto,
    opts: { skipStoreFilter?: boolean } = {},
  ): SelectQueryBuilder<Product> {
    const qb = this.productsRepository
      .createQueryBuilder('product')
      .leftJoin('product.store', 'store')
      .leftJoin('product.category', 'category');

    if (query.search) {
      qb.andWhere('(product.name ILIKE :search OR product.description ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    if (query.categoryId) {
      qb.andWhere('product.category = :categoryId', { categoryId: query.categoryId });
    }
    if (!opts.skipStoreFilter && query.storeId) {
      qb.andWhere('product.store = :storeId', { storeId: query.storeId });
    }
    if (query.minPrice !== undefined) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = product.id AND v.price >= :minPrice AND v.deleted_at IS NULL)',
        { minPrice: query.minPrice },
      );
    }
    if (query.maxPrice !== undefined) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = product.id AND v.price <= :maxPrice AND v.deleted_at IS NULL)',
        { maxPrice: query.maxPrice },
      );
    }
    if (query.minRating !== undefined) {
      qb.andWhere('product.ratingAverage >= :minRating', { minRating: query.minRating });
    }

    // Ordered via the raw subquery expression directly, NOT via addSelect —
    // paginateFilterQuery() below replaces the select list wholesale with
    // `.select('product.id', 'id')` for the ID/count step, which would
    // silently drop an addSelect-based alias and break ORDER BY. A raw
    // expression in .orderBy() has no such dependency on the select list.
    const minPriceExpr =
      '(SELECT MIN(v.price) FROM product_variants v WHERE v.product_id = product.id AND v.deleted_at IS NULL)';
    switch (query.sort) {
      case 'price_asc':
        qb.orderBy(minPriceExpr, 'ASC', 'NULLS LAST');
        break;
      case 'price_desc':
        qb.orderBy(minPriceExpr, 'DESC', 'NULLS LAST');
        break;
      case 'rating':
        qb.orderBy('product.ratingAverage', 'DESC');
        break;
      case 'newest':
      default:
        qb.orderBy('product.createdAt', 'DESC');
    }

    return qb;
  }

  /** Runs the (safe-to-paginate) filter query for IDs + total count, then
   * hydrates exactly that page's products with their full to-many relations
   * in a second query — this is the two-step pattern that keeps pagination
   * correct in the presence of OneToMany joins. */
  private async paginateFilterQuery(
    qb: SelectQueryBuilder<Product>,
    query: ProductsQueryDto,
  ): Promise<PaginatedResult<Product>> {
    const total = await qb.clone().getCount();

    const rows = await qb
      .select('product.id', 'id')
      .offset(query.skip)
      .limit(query.limit)
      .getRawMany<{ id: string }>();
    const orderedIds = rows.map((r) => r.id);

    if (orderedIds.length === 0) {
      return paginate([], total, query.page, query.limit);
    }

    const products = await this.productsRepository.find({
      where: { id: In(orderedIds) },
      relations: PRODUCT_RELATIONS,
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    const ordered = orderedIds.map((id) => byId.get(id)).filter((p): p is Product => !!p);

    return paginate(ordered, total, query.page, query.limit);
  }
}
