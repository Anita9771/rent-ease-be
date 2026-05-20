import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class AcceptInviteDto {
  @IsString()
  inviteToken!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

