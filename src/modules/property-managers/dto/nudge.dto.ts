import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export enum NudgeType {
  TENANT_PAYMENT = 'TENANT_PAYMENT',
  LANDLORD_RECEIPT = 'LANDLORD_RECEIPT',
}

export class CreateNudgeDto {
  @IsEnum(NudgeType)
  type!: NudgeType;

  @IsUUID()
  targetUserId!: string;

  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @IsOptional()
  @IsString()
  message?: string;
}

