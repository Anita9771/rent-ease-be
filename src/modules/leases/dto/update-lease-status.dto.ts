import { IsEnum } from 'class-validator';
import { LeaseStatus } from './create-lease.dto';

export class UpdateLeaseStatusDto {
  @IsEnum(LeaseStatus)
  status!: LeaseStatus;
}

