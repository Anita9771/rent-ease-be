import { IsEmail, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class RegisterLandlordDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  companyName!: string;

  @IsString()
  displayName!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'avatarUrl must be a valid URL' })
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

