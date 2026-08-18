import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { VendorStatus } from '../../entities/enums';

/**
 * Stacks on top of @Roles(UserRole.VENDOR). Role alone only proves "this
 * account applied to sell" — it does NOT prove admin approval. Any endpoint
 * that lets a vendor actually create/mutate marketplace-facing data (products,
 * fulfillment status, etc.) must use this guard; endpoints that just let a
 * pending applicant check their own status (GET /vendors/me) must not.
 */
@Injectable()
export class VendorApprovedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (!user?.vendor || user.vendor.status !== VendorStatus.APPROVED) {
      throw new ForbiddenException(
        'Your vendor account is not yet approved for this action',
      );
    }
    return true;
  }
}
