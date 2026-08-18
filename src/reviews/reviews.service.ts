import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResult, paginate } from '../common/dto/paginated-result';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { OrderPaymentStatus } from '../entities/enums';
import { OrderItem } from '../entities/order-item.entity';
import { Product } from '../entities/product.entity';
import { Review } from '../entities/review.entity';
import { User } from '../entities/user.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewsRepository: Repository<Review>,
    @InjectRepository(OrderItem)
    private readonly orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  async findForProduct(productId: string, query: PaginationQueryDto): Promise<PaginatedResult<Review>> {
    const [data, total] = await this.reviewsRepository.findAndCount({
      where: { product: { id: productId } },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });
    return paginate(data, total, query.page, query.limit);
  }

  async create(user: User, productId: string, dto: CreateReviewDto): Promise<Review> {
    if (await this.reviewsRepository.exist({ where: { user: { id: user.id }, product: { id: productId } } })) {
      throw new ConflictException(
        'You have already reviewed this product — use PATCH to edit your review',
      );
    }

    const orderItem = await this.findEligibleOrderItem(user.id, productId);
    if (!orderItem) {
      throw new ForbiddenException(
        'You can only review products from a completed order you actually purchased',
      );
    }

    const review = this.reviewsRepository.create({
      user,
      product: { id: productId } as Product,
      orderItem,
      rating: dto.rating,
      title: dto.title ?? null,
      comment: dto.comment ?? null,
    });
    await this.reviewsRepository.save(review);

    await this.recomputeProductRating(productId);
    return review;
  }

  async update(user: User, id: string, dto: UpdateReviewDto): Promise<Review> {
    const review = await this.findOwnedOrThrow(user.id, id);

    if (dto.rating !== undefined) review.rating = dto.rating;
    if (dto.title !== undefined) review.title = dto.title;
    if (dto.comment !== undefined) review.comment = dto.comment;
    await this.reviewsRepository.save(review);

    await this.recomputeProductRating(review.product.id);
    return review;
  }

  async remove(user: User, id: string): Promise<void> {
    const review = await this.findOwnedOrThrow(user.id, id);
    await this.reviewsRepository.softRemove(review);
    await this.recomputeProductRating(review.product.id);
  }

  /** Proof of purchase: an OrderItem whose variant belongs to this product,
   * under a VendorOrder/Order that belongs to this user AND has actually
   * been paid. A FK to order_item_id alone would not prove any of this on
   * its own — this query is the actual enforcement. */
  private findEligibleOrderItem(userId: string, productId: string): Promise<OrderItem | null> {
    return this.orderItemsRepository
      .createQueryBuilder('orderItem')
      .innerJoin('orderItem.vendorOrder', 'vendorOrder')
      .innerJoin('vendorOrder.order', 'order')
      .innerJoin('orderItem.variant', 'variant')
      .where('order.user = :userId', { userId })
      .andWhere('order.paymentStatus = :paid', { paid: OrderPaymentStatus.PAID })
      .andWhere('variant.product = :productId', { productId })
      .getOne();
  }

  private async findOwnedOrThrow(userId: string, id: string): Promise<Review> {
    const review = await this.reviewsRepository.findOne({
      where: { id },
      relations: ['user', 'product'],
    });
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    if (review.user.id !== userId) {
      throw new ForbiddenException('You can only edit your own review');
    }
    return review;
  }

  private async recomputeProductRating(productId: string): Promise<void> {
    const { average, count } = await this.reviewsRepository
      .createQueryBuilder('review')
      .select('COALESCE(AVG(review.rating), 0)', 'average')
      .addSelect('COUNT(review.id)', 'count')
      .where('review.product = :productId', { productId })
      .getRawOne<{ average: string; count: string }>()
      .then((r) => ({ average: r?.average ?? '0', count: r?.count ?? '0' }));

    await this.productsRepository.update(productId, {
      ratingAverage: Number(average).toFixed(2),
      reviewCount: Number(count),
    });
  }
}
