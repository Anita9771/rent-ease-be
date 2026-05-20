import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateExpenseDto {
  @IsUUID()
  @IsOptional()
  propertyId?: string;

  @IsUUID()
  @IsOptional()
  unitId?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @IsString()
  @MaxLength(120)
  category!: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @IsDateString()
  incurredAt!: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;
}

