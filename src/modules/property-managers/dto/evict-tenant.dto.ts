import { IsString, IsUUID, IsDateString } from 'class-validator';

export class EvictTenantDto {
  @IsUUID()
  tenantId!: string;

  @IsUUID()
  leaseId!: string;

  @IsString()
  reason!: string;

  @IsDateString()
  evictionDate!: string;
}

