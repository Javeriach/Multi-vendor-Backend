import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Store } from '../entities/store.entity';
import { Vendor } from '../entities/vendor.entity';
import { UsersModule } from '../users/users.module';
import { AdminVendorsController, VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';

@Module({
  imports: [TypeOrmModule.forFeature([Vendor, Store]), UsersModule],
  controllers: [VendorsController, AdminVendorsController],
  providers: [VendorsService],
  exports: [VendorsService],
})
export class VendorsModule {}
