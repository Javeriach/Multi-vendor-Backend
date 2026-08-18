import { UserRole } from '../entities/enums';

export interface JwtPayload {
  sub: string;
  role: UserRole;
}
