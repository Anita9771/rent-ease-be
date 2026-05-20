import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class SendInvoiceReminderDto {
  @IsOptional()
  @IsString()
  channel?: 'email' | 'sms' | 'in_app';

  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

