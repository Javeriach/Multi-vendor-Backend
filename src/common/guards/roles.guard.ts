import { ForbiddenException, Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../entities/enums';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Runs AFTER JwtAuthGuard (guard order in a class's @UseGuards array, or the
 * global APP_GUARD registration order, matters — this guard reads
 * `request.user`, which only exists once JwtAuthGuard has populated it).
 * A route with no @Roles(...) is allowed for any authenticated user; this
 * guard only restricts routes that explicitly declare required roles.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `This action requires one of the following roles: ${requiredRoles.join(', ')}`,
      );
    }
    return true;
  }
}
