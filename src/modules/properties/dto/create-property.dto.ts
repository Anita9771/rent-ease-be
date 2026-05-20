import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePropertyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

