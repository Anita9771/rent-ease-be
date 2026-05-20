import { ComplaintStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateComplaintStatusDto {
  @IsEnum(ComplaintStatus)
  status!: ComplaintStatus;
}

