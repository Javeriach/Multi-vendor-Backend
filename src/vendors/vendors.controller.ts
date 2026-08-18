import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginatedResult } from '../common/dto/paginated-result';
import { UserRole } from '../entities/enums';
import { User } from '../entities/user.entity';
import { Vendor } from '../entities/vendor.entity';
import { Store } from '../entities/store.entity';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { UpdateVendorStatusDto } from './dto/update-vendor-status.dto';
import { VendorsQueryDto } from './dto/vendors-query.dto';
import { VendorsService } from './vendors.service';

@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  /** Any authenticated customer can apply — becoming a vendor upgrades the
   * account rather than requiring a separate signup. */
  @Roles(UserRole.CUSTOMER)
  @Post()
  onboard(@CurrentUser() user: User, @Body() dto: CreateVendorDto): Promise<Vendor> {
    return this.vendorsService.onboard(user, dto);
  }

  @Roles(UserRole.VENDOR)
  @Get('me')
  findMine(@CurrentUser() user: User): Promise<Vendor> {
    return this.vendorsService.findMine(user.id);
  }

  @Roles(UserRole.VENDOR)
  @Patch('me')
  updateMyStore(@CurrentUser() user: User, @Body() dto: UpdateStoreDto): Promise<Store> {
    return this.vendorsService.updateMyStore(user.id, dto);
  }

  @Public()
  @Get(':id')
  findPublic(@Param('id', ParseUUIDPipe) id: string): Promise<Vendor> {
    return this.vendorsService.findPublicById(id);
  }
}

@Controller('admin/vendors')
export class AdminVendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Roles(UserRole.ADMIN)
  @Get()
  list(@Query() query: VendorsQueryDto): Promise<PaginatedResult<Vendor>> {
    return this.vendorsService.adminList(query);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVendorStatusDto,
  ): Promise<Vendor> {
    return this.vendorsService.adminUpdateStatus(id, dto.status);
  }
}
