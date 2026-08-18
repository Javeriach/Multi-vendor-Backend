import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Onboards a Customer into a Vendor AND creates their Store in one call —
 * v1 enforces exactly one store per vendor, so there is no separate
 * POST /stores endpoint (see Store entity for why the schema itself doesn't
 * hard-enforce that 1:1, only the service layer does). */
export class CreateVendorDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  businessName: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  taxId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  storeName: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase letters, numbers, and hyphens only',
  })
  @MaxLength(255)
  storeSlug?: string;

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
