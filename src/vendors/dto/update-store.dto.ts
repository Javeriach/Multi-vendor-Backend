import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Editable by the owning vendor. Deliberately excludes `status` — a vendor
 * can never set their own store's approval state (see VendorsController's
 * separate, admin-only status endpoint). */
export class UpdateStoreDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bannerUrl?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  contactPhone?: string;
}
