import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateInvoiceDto {
  @IsUUID()
  leaseId!: string;

  @IsUUID()
  tenantId!: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsDateString()
  dueDate!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  amountDue?: number;

  @IsOptional()
  @IsNotEmpty()
  memo?: string;
}

