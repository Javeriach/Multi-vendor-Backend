import { Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../entities/enums';
import { User } from '../entities/user.entity';
import { Wishlist } from '../entities/wishlist.entity';
import { WishlistService } from './wishlist.service';

@Roles(UserRole.CUSTOMER, UserRole.VENDOR)
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  getMine(@CurrentUser() user: User): Promise<Wishlist> {
    return this.wishlistService.getMine(user);
  }

  @Post(':productId')
  addItem(
    @CurrentUser() user: User,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<Wishlist> {
    return this.wishlistService.addItem(user, productId);
  }

  @Delete(':productId')
  removeItem(
    @CurrentUser() user: User,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<Wishlist> {
    return this.wishlistService.removeItem(user, productId);
  }
}
