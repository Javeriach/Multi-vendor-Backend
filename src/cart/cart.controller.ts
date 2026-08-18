import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Cart } from '../entities/cart.entity';
import { UserRole } from '../entities/enums';
import { User } from '../entities/user.entity';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Roles(UserRole.CUSTOMER, UserRole.VENDOR)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getMine(@CurrentUser() user: User): Promise<Cart> {
    return this.cartService.getMine(user);
  }

  @Post('items')
  addItem(@CurrentUser() user: User, @Body() dto: AddCartItemDto): Promise<Cart> {
    return this.cartService.addItem(user, dto);
  }

  @Patch('items/:itemId')
  updateItem(
    @CurrentUser() user: User,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<Cart> {
    return this.cartService.updateItem(user, itemId, dto);
  }

  @Delete('items/:itemId')
  removeItem(
    @CurrentUser() user: User,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<Cart> {
    return this.cartService.removeItem(user, itemId);
  }

  @Delete()
  clear(@CurrentUser() user: User): Promise<Cart> {
    return this.cartService.clear(user);
  }
}
