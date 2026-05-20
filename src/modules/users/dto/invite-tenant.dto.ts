import { IsEmail, IsUUID } from 'class-validator';

export class InviteTenantDto {
  @IsEmail()
  email!: string;

  @IsUUID()
  propertyId!: string;
}

