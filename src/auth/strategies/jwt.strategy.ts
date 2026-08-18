import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User } from '../../entities/user.entity';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '../jwt-payload.interface';

const cookieExtractor = (req: Request): string | null => {
  return req?.cookies?.access_token ?? null;
};

/**
 * Re-fetches the full User row from the database on EVERY request rather
 * than trusting the role embedded in the token payload. This means a role
 * change, a vendor suspension, or a soft-deleted account takes effect
 * immediately on the user's very next request — not only after their token
 * expires and they log in again. The extra query is a deliberate trade-off
 * for correctness ("do not trust role information supplied by the frontend"
 * extends to not trusting a *stale* token either).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    // TypeORM's default find() already excludes soft-deleted rows, so a
    // deactivated account resolves to `null` here, not a row with deletedAt set.
    const user = await this.usersService.findByIdWithVendor(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Account not found or has been deactivated');
    }
    return user;
  }
}
