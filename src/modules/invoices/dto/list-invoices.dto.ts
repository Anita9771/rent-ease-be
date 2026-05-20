import { IsEnum, IsOptional } from 'class-validator';
import { InvoiceStatus } from '@prisma/client';

export class ListInvoicesDto {
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;
}

