import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ComplaintStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { UpdateComplaintStatusDto } from './dto/update-complaint-status.dto';
import { CreateComplaintCommentDto } from './dto/create-comment.dto';

@Injectable()
export class ComplaintsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, landlordId: string, actorUserId: string, dto: CreateComplaintDto) {
    if (dto.leaseId) {
      const lease = await this.prisma.lease.findFirst({
        where: { id: dto.leaseId, tenantId, landlordId },
      });
      if (!lease) {
        throw new BadRequestException('Lease not found for tenant');
      }
    }

    const landlord = await this.prisma.landlord.findUnique({
      where: { id: landlordId },
      include: { user: true },
    });
    if (!landlord) {
      throw new NotFoundException('Landlord not found');
    }

    const complaint = await this.prisma.complaint.create({
      data: {
        landlordId,
        tenantId,
        leaseId: dto.leaseId,
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        status: ComplaintStatus.OPEN,
      },
      include: {
        tenant: { include: { user: true } },
        landlord: { include: { user: true } },
      },
    });

    await this.prisma.notification.create({
      data: {
        userId: landlord.user.id,
        type: 'COMPLAINT_CREATED',
        payload: {
          complaintId: complaint.id,
          title: complaint.title,
          priority: complaint.priority,
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: 'COMPLAINT_CREATED',
        entityType: 'COMPLAINT',
        entityId: complaint.id,
      },
    });

    return complaint;
  }

  listForLandlord(landlordId: string) {
    return this.prisma.complaint.findMany({
      where: { landlordId },
      include: {
        tenant: { include: { user: true } },
        comments: { include: { author: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  listForTenant(tenantId: string) {
    return this.prisma.complaint.findMany({
      where: { tenantId },
      include: {
        comments: { include: { author: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listForPropertyManager(propertyManagerId: string) {
    // Get assigned properties for this property manager
    const assignments = await this.prisma.propertyManagerAssignment.findMany({
      where: { propertyManagerId },
      select: { propertyId: true },
    });
    const propertyIds = assignments.map((a) => a.propertyId);

    if (propertyIds.length === 0) {
      return [];
    }

    // Get complaints from tenants in assigned properties
    return this.prisma.complaint.findMany({
      where: {
        lease: {
          unit: {
            propertyId: { in: propertyIds },
          },
        },
      },
      include: {
        tenant: { include: { user: true } },
        lease: {
          include: {
            unit: {
              include: { property: true },
            },
          },
        },
        comments: { include: { author: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(landlordId: string, actorUserId: string, complaintId: string, dto: UpdateComplaintStatusDto) {
    const complaint = await this.prisma.complaint.findFirst({
      where: { id: complaintId, landlordId },
      include: { tenant: { include: { user: true } }, landlord: { include: { user: true } } },
    });
    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    const updated = await this.prisma.complaint.update({
      where: { id: complaintId },
      data: {
        status: dto.status as ComplaintStatus,
        ...(dto.status === ComplaintStatus.RESOLVED && { resolvedAt: new Date() }),
      },
    });

    await this.prisma.notification.create({
      data: {
        userId: complaint.tenant.user.id,
        type: 'COMPLAINT_STATUS_UPDATED',
        payload: {
          complaintId,
          status: dto.status,
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: 'COMPLAINT_STATUS_UPDATED',
        entityType: 'COMPLAINT',
        entityId: complaintId,
        metadata: { status: dto.status },
      },
    });

    return updated;
  }

  async updateStatusForPropertyManager(propertyManagerId: string, actorUserId: string, complaintId: string, dto: UpdateComplaintStatusDto) {
    // Get assigned properties
    const assignments = await this.prisma.propertyManagerAssignment.findMany({
      where: { propertyManagerId },
      select: { propertyId: true },
    });
    const propertyIds = assignments.map((a) => a.propertyId);

    if (propertyIds.length === 0) {
      throw new NotFoundException('Complaint not found');
    }

    const complaint = await this.prisma.complaint.findFirst({
      where: {
        id: complaintId,
        lease: {
          unit: {
            propertyId: { in: propertyIds },
          },
        },
      },
      include: { tenant: { include: { user: true } }, landlord: { include: { user: true } } },
    });
    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    const updated = await this.prisma.complaint.update({
      where: { id: complaintId },
      data: {
        status: dto.status as ComplaintStatus,
        ...(dto.status === ComplaintStatus.RESOLVED && { resolvedAt: new Date() }),
      },
    });

    await this.prisma.notification.create({
      data: {
        userId: complaint.tenant.user.id,
        type: 'COMPLAINT_STATUS_UPDATED',
        payload: {
          complaintId,
          status: dto.status,
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: 'COMPLAINT_STATUS_UPDATED',
        entityType: 'COMPLAINT',
        entityId: complaintId,
        metadata: { status: dto.status },
      },
    });

    return updated;
  }

  async getByIdForUser(
    complaintId: string,
    user: { role: string; landlordId?: string; tenantId?: string; propertyManagerId?: string; sub: string },
  ) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id: complaintId },
      include: {
        tenant: { include: { user: true } },
        landlord: { include: { user: true } },
        lease: {
          include: {
            unit: { include: { property: true } },
          },
        },
        comments: {
          include: { author: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    if (user.role === 'LANDLORD' && complaint.landlordId !== user.landlordId) {
      throw new NotFoundException('Complaint not found');
    }
    if (user.role === 'TENANT' && complaint.tenantId !== user.tenantId) {
      throw new NotFoundException('Complaint not found');
    }
    if (user.role === 'PROPERTY_MANAGER' && user.propertyManagerId) {
      const assignments = await this.prisma.propertyManagerAssignment.findMany({
        where: { propertyManagerId: user.propertyManagerId },
        select: { propertyId: true },
      });
      const propertyIds = assignments.map((a) => a.propertyId);
      const complaintPropertyId = complaint.lease?.unit?.propertyId;
      if (!complaintPropertyId || !propertyIds.includes(complaintPropertyId)) {
        throw new NotFoundException('Complaint not found');
      }
    }

    return this.formatComplaintDetail(complaint);
  }

  private formatComplaintDetail(complaint: any) {
    return {
      id: complaint.id,
      title: complaint.title,
      description: complaint.description,
      priority: complaint.priority,
      status: complaint.status,
      createdAt: complaint.createdAt.toISOString(),
      updatedAt: (complaint.resolvedAt ?? complaint.createdAt).toISOString(),
      tenant: complaint.tenant
        ? {
            id: complaint.tenant.id,
            user: { email: complaint.tenant.user.email },
          }
        : null,
      lease: complaint.lease
        ? {
            unit: {
              unitNumber: complaint.lease.unit.unitNumber,
              property: complaint.lease.unit.property
                ? { id: complaint.lease.unit.property.id, name: complaint.lease.unit.property.name }
                : null,
            },
          }
        : null,
      comments: complaint.comments.map((c: any) => ({
        id: c.id,
        message: c.message,
        createdAt: c.createdAt.toISOString(),
        author: {
          id: c.author.id,
          email: c.author.email,
          role: c.author.role,
        },
      })),
    };
  }

  async addComment(complaintId: string, actorUserId: string, dto: CreateComplaintCommentDto) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id: complaintId },
      include: { tenant: { include: { user: true } }, landlord: { include: { user: true } } },
    });
    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    const comment = await this.prisma.complaintComment.create({
      data: {
        complaintId,
        userId: actorUserId,
        message: dto.message,
      },
      include: {
        author: true,
      },
    });

    const notifyUserId = actorUserId === complaint.tenant.user.id ? complaint.landlord.user.id : complaint.tenant.user.id;

    await this.prisma.notification.create({
      data: {
        userId: notifyUserId,
        type: 'COMPLAINT_COMMENT',
        payload: {
          complaintId,
          commentId: comment.id,
        },
      },
    });

    return comment;
  }
}

