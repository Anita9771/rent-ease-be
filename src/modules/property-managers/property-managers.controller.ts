import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PropertyManagersService } from './property-managers.service';
import { InvitePropertyManagerDto } from './dto/invite-property-manager.dto';
import { AssignPropertyDto } from './dto/assign-property.dto';
import { EvictTenantDto } from './dto/evict-tenant.dto';
import { CreateNudgeDto } from './dto/nudge.dto';
import { InviteTenantDto } from '../users/dto/invite-tenant.dto';

@UseGuards(JwtAuthGuard)
@Controller('property-managers')
export class PropertyManagersController {
  constructor(private readonly propertyManagersService: PropertyManagersService) {}

  // Landlord endpoints
  @Post('invite')
  invitePropertyManager(
    @CurrentUser('landlordId') landlordId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: InvitePropertyManagerDto,
  ) {
    return this.propertyManagersService.invitePropertyManager(landlordId, actorUserId, dto);
  }

  @Get()
  listPropertyManagers(@CurrentUser('landlordId') landlordId: string) {
    return this.propertyManagersService.listPropertyManagers(landlordId);
  }

  @Post(':id/assign-properties')
  assignProperties(
    @CurrentUser('landlordId') landlordId: string,
    @Param('id') propertyManagerId: string,
    @Body() dto: AssignPropertyDto,
  ) {
    return this.propertyManagersService.assignProperties(landlordId, propertyManagerId, dto);
  }

  @Delete(':id')
  removePropertyManager(
    @CurrentUser('landlordId') landlordId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id') propertyManagerId: string,
  ) {
    return this.propertyManagersService.removePropertyManager(landlordId, propertyManagerId, actorUserId);
  }

  @Delete('tenants/:tenantId')
  removeTenant(
    @CurrentUser('landlordId') landlordId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('tenantId') tenantId: string,
  ) {
    return this.propertyManagersService.removeTenant(landlordId, tenantId, actorUserId);
  }

  // Property Manager endpoints
  @Get('dashboard')
  getDashboard(@CurrentUser('propertyManagerId') propertyManagerId: string) {
    return this.propertyManagersService.getDashboard(propertyManagerId);
  }

  @Get('properties')
  getAssignedProperties(@CurrentUser('propertyManagerId') propertyManagerId: string) {
    return this.propertyManagersService.getAssignedProperties(propertyManagerId);
  }

  @Get('tenants')
  getAssignedTenants(@CurrentUser('propertyManagerId') propertyManagerId: string) {
    return this.propertyManagersService.getAssignedTenants(propertyManagerId);
  }

  @Post('tenants/invite')
  inviteTenant(
    @CurrentUser('propertyManagerId') propertyManagerId: string,
    @CurrentUser('landlordId') landlordId: string,
    @Body() dto: InviteTenantDto,
  ) {
    return this.propertyManagersService.inviteTenant(propertyManagerId, landlordId, dto);
  }

  @Get('complaints')
  getAssignedComplaints(@CurrentUser('propertyManagerId') propertyManagerId: string) {
    return this.propertyManagersService.getAssignedComplaints(propertyManagerId);
  }

  @Post('evict-tenant')
  evictTenant(
    @CurrentUser('propertyManagerId') propertyManagerId: string,
    @Body() dto: EvictTenantDto,
  ) {
    return this.propertyManagersService.evictTenant(propertyManagerId, dto);
  }

  @Post('nudge')
  createNudge(
    @CurrentUser('propertyManagerId') propertyManagerId: string,
    @Body() dto: CreateNudgeDto,
  ) {
    return this.propertyManagersService.createNudge(propertyManagerId, dto);
  }
}

