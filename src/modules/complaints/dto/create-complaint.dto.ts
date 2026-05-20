import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export enum ComplaintPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export class CreateComplaintDto {
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsString()
  @MaxLength(2000)
  description!: string;

  @IsEnum(ComplaintPriority)
  priority!: ComplaintPriority;

  @IsOptional()
  @IsUUID()
  leaseId?: string;
}

