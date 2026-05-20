import { IsEmail, IsOptional, IsString } from 'class-validator';

export class ContactSalesDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  company!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  units?: string;

  @IsOptional()
  @IsString()
  message?: string;
}

