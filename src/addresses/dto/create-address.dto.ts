import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  streetAddress: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  area: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  country: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  postalCode: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
