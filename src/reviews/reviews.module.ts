import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderItem } from '../entities/order-item.entity';
import { Product } from '../entities/product.entity';
import { Review } from '../entities/review.entity';
import { ProductReviewsController, ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [TypeOrmModule.forFeature([Review, OrderItem, Product])],
  controllers: [ProductReviewsController, ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
