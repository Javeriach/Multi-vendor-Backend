import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginatedResult } from '../common/dto/paginated-result';
import { UserRole } from '../entities/enums';
import { Order } from '../entities/order.entity';
import { User } from '../entities/user.entity';
import { VendorOrder } from '../entities/vendor-order.entity';
import { CheckoutDto } from './dto/checkout.dto';
import { OrdersQueryDto, VendorOrdersQueryDto } from './dto/orders-query.dto';
import { UpdateVendorOrderStatusDto } from './dto/update-vendor-order-status.dto';
import { OrdersService } from './orders.service';

// -------------------------------------------------------------- customer

@Roles(UserRole.CUSTOMER, UserRole.VENDOR)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findMine(
    @CurrentUser() user: User,
    @Query() query: OrdersQueryDto,
  ): Promise<PaginatedResult<Order>> {
    return this.ordersService.findMine(user, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string): Promise<Order> {
    return this.ordersService.findMineById(user, id);
  }
}

@Roles(UserRole.CUSTOMER, UserRole.VENDOR)
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  checkout(
    @CurrentUser() user: User,
    @Body() dto: CheckoutDto,
  ): Promise<{ order: Order; checkoutUrl: string }> {
    return this.ordersService.checkout(user, dto);
  }
}

// ---------------------------------------------------------------- vendor

@Roles(UserRole.VENDOR)
@Controller('vendor/orders')
export class VendorOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findMine(
    @CurrentUser() user: User,
    @Query() query: VendorOrdersQueryDto,
  ): Promise<PaginatedResult<VendorOrder>> {
    return this.ordersService.findVendorOrders(user, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VendorOrder> {
    return this.ordersService.findVendorOrderById(user, id);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVendorOrderStatusDto,
  ): Promise<VendorOrder> {
    return this.ordersService.updateVendorOrderStatus(user, id, dto);
  }
}

// ---------------------------------------------------------------- admin

@Roles(UserRole.ADMIN)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(@Query() query: OrdersQueryDto): Promise<PaginatedResult<Order>> {
    return this.ordersService.adminFindAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Order> {
    return this.ordersService.adminFindOne(id);
  }
}
