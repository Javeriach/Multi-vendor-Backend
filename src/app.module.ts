import { ClassSerializerInterceptor, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { AddressesModule } from './addresses/addresses.module';
import { AuthModule } from './auth/auth.module';
import { CartModule } from './cart/cart.module';
import { CategoriesModule } from './categories/categories.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { getPostgresConnectionOptions } from './database/postgres-connection-options';
import { entities } from './entities';
import { HealthController } from './health/health.controller';
import { OrdersModule } from './orders/orders.module';
import { ProductsModule } from './products/products.module';
import { ReviewsModule } from './reviews/reviews.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';
import { VendorsModule } from './vendors/vendors.module';
import { WishlistModule } from './wishlist/wishlist.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...getPostgresConnectionOptions((key) => config.get<string>(key)),
        namingStrategy: new SnakeNamingStrategy(),
        entities,
        // Never true here — schema changes only ever happen through a
        // reviewed migration in src/database/migrations.
        synchronize: false,
        logging: config.get<string>('NODE_ENV') === 'development',
      }),
    }),
    UsersModule,
    AuthModule,
    VendorsModule,
    CategoriesModule,
    ProductsModule,
    CartModule,
    WishlistModule,
    AddressesModule,
    OrdersModule,
    ReviewsModule,
    UploadsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Every route requires a valid JWT by default (opt out with @Public()) —
    // then RolesGuard restricts further to specific roles where @Roles() is
    // declared. Order matters: Nest runs APP_GUARD providers in registration
    // order, and RolesGuard depends on JwtAuthGuard having already populated
    // request.user.
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector) => new JwtAuthGuard(reflector),
      inject: [Reflector],
    },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },
  ],
})
export class AppModule {}
