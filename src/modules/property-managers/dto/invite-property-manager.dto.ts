import { IsEmail, IsOptional, IsString } from 'class-validator';

export class InvitePropertyManagerDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  title?: string;
}

