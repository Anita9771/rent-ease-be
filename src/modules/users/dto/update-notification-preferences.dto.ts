import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  emailLandlordSummary?: boolean;

  @IsOptional()
  @IsBoolean()
  smsEscalations?: boolean;

  @IsOptional()
  @IsBoolean()
  tenantFeedbackDigest?: boolean;
}
