import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ComplaintsService } from './complaints.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { UpdateComplaintStatusDto } from './dto/update-complaint-status.dto';
import { CreateComplaintCommentDto } from './dto/create-comment.dto';

@UseGuards(JwtAuthGuard)
@Controller('complaints')
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Get()
  async list(@CurrentUser() user: any) {
    if (user.role === 'LANDLORD') {
      const complaints = await this.complaintsService.listForLandlord(user.landlordId);
      return complaints.map((complaint) => ({
        id: complaint.id,
        title: complaint.title,
        description: complaint.description,
        priority: complaint.priority,
        status: complaint.status,
        tenant: {
          id: complaint.tenant.id,
          user: {
            email: complaint.tenant.user.email,
          },
        },
        createdAt: complaint.createdAt.toISOString(),
        updatedAt: complaint.resolvedAt?.toISOString() || complaint.createdAt.toISOString(),
        comments: complaint.comments,
      }));
    }

    if (user.role === 'PROPERTY_MANAGER') {
      const complaints = await this.complaintsService.listForPropertyManager(user.propertyManagerId);
      return complaints.map((complaint) => ({
        id: complaint.id,
        title: complaint.title,
        description: complaint.description,
        priority: complaint.priority,
        status: complaint.status,
        tenant: {
          id: complaint.tenant.id,
          user: {
            email: complaint.tenant.user.email,
          },
        },
        lease: complaint.lease
          ? {
              unit: {
                unitNumber: complaint.lease.unit.unitNumber,
                property: complaint.lease.unit.property
                  ? {
                      name: complaint.lease.unit.property.name,
                    }
                  : null,
              },
            }
          : null,
        createdAt: complaint.createdAt.toISOString(),
        updatedAt: complaint.resolvedAt?.toISOString() || complaint.createdAt.toISOString(),
        comments: complaint.comments,
      }));
    }

    if (user.role === 'TENANT') {
      const complaints = await this.complaintsService.listForTenant(user.tenantId);
      return complaints.map((complaint) => ({
        id: complaint.id,
        title: complaint.title,
        description: complaint.description,
        priority: complaint.priority,
        status: complaint.status,
        createdAt: complaint.createdAt.toISOString(),
        updatedAt: complaint.resolvedAt?.toISOString() || complaint.createdAt.toISOString(),
        comments: complaint.comments,
      }));
    }

    return [];
  }

  @Get(':id')
  getOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.complaintsService.getByIdForUser(id, user);
  }

  @Post()
  create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('landlordId') landlordId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: CreateComplaintDto,
  ) {
    return this.complaintsService.create(tenantId, landlordId, actorUserId, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: any,
    @CurrentUser('sub') actorUserId: string,
    @Param('id') complaintId: string,
    @Body() dto: UpdateComplaintStatusDto,
  ) {
    if (user.role === 'PROPERTY_MANAGER' && user.propertyManagerId) {
      return this.complaintsService.updateStatusForPropertyManager(
        user.propertyManagerId,
        actorUserId,
        complaintId,
        dto,
      );
    }
    return this.complaintsService.updateStatus(user.landlordId, actorUserId, complaintId, dto);
  }

  @Post(':id/comments')
  addComment(
    @CurrentUser('sub') actorUserId: string,
    @Param('id') complaintId: string,
    @Body() dto: CreateComplaintCommentDto,
  ) {
    return this.complaintsService.addComment(complaintId, actorUserId, dto);
  }
}

