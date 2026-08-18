import { Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginatedResult } from '../common/dto/paginated-result';
import { UserRole } from '../entities/enums';
import { User } from '../entities/user.entity';
import { UsersQueryDto } from './dto/users-query.dto';
import { UsersService } from './users.service';

@Roles(UserRole.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@Query() query: UsersQueryDto): Promise<PaginatedResult<User>> {
    return this.usersService.adminFindAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<User> {
    return this.usersService.findById(id);
  }

  @Patch(':id/deactivate')
  async deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    await this.usersService.adminDeactivate(id);
    return { message: 'Account deactivated' };
  }

  @Patch(':id/reactivate')
  reactivate(@Param('id', ParseUUIDPipe) id: string): Promise<User> {
    return this.usersService.adminReactivate(id);
  }
}
