import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../entities/enums';

export const ROLES_KEY = 'roles';

/** Marks a route as requiring one of the given roles. Must be paired with
 * JwtAuthGuard + RolesGuard (see app-wide guard registration in main.ts) —
 * on its own this decorator does nothing but attach metadata. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
