import { IsOptional, IsString } from 'class-validator';

export class GenerateInvoicesDto {
  @IsOptional()
  @IsString()
  month?: string; // Format: YYYY-MM
}

