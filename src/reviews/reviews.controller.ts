import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginatedResult } from '../common/dto/paginated-result';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { UserRole } from '../entities/enums';
import { Review } from '../entities/review.entity';
import { User } from '../entities/user.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReviewsService } from './reviews.service';

@Controller('products/:productId/reviews')
export class ProductReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Public()
  @Get()
  findForProduct(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<Review>> {
    return this.reviewsService.findForProduct(productId, query);
  }

  @Roles(UserRole.CUSTOMER, UserRole.VENDOR)
  @Post()
  create(
    @CurrentUser() user: User,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: CreateReviewDto,
  ): Promise<Review> {
    return this.reviewsService.create(user, productId, dto);
  }
}

@Roles(UserRole.CUSTOMER, UserRole.VENDOR)
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReviewDto,
  ): Promise<Review> {
    return this.reviewsService.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.reviewsService.remove(user, id);
  }
}
