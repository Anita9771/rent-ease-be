import { Body, Controller, Get, Patch, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { IsOptional, IsString, IsUrl } from 'class-validator';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  emergencyContact?: {
    name?: string;
    phone?: string;
    relationship?: string;
  };

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'avatarUrl must be a valid URL' })
  avatarUrl?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getCurrentUser(@CurrentUser('sub') userId: string) {
    return this.usersService.getCurrentUser(userId);
  }

  @Patch('me')
  @Put('me')
  updateProfile(
    @CurrentUser('sub') userId: string,
    @CurrentUser('tenantId') tenantId: string | undefined,
    @CurrentUser('landlordId') landlordId: string | undefined,
    @CurrentUser('propertyManagerId') propertyManagerId: string | undefined,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, tenantId, landlordId, propertyManagerId, dto);
  }

  @Get('me/notification-preferences')
  getNotificationPreferences(@CurrentUser('landlordId') landlordId: string | undefined) {
    return this.usersService.getNotificationPreferences(landlordId);
  }

  @Patch('me/notification-preferences')
  updateNotificationPreferences(
    @CurrentUser('landlordId') landlordId: string | undefined,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.usersService.updateNotificationPreferences(landlordId, dto);
  }
}

