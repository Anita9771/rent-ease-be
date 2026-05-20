import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export enum LeaseStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING',
  TERMINATED = 'TERMINATED',
  COMPLETED = 'COMPLETED',
}

export enum RentFrequency {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

export enum LateFeeType {
  FLAT = 'FLAT',
  PERCENTAGE = 'PERCENTAGE',
}

export class CreateLeaseDto {
  @IsUUID()
  tenantId!: string;

  @IsUUID()
  unitId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  rentAmount!: number;

  @IsEnum(RentFrequency)
  rentFrequency!: RentFrequency;

  @IsEnum(LateFeeType)
  @IsOptional()
  lateFeeType?: LateFeeType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  lateFeeValue?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  depositAmount?: number;

  @IsEnum(LeaseStatus)
  @IsOptional()
  status?: LeaseStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  memo?: string;
}

