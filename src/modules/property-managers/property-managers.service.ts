import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvitePropertyManagerDto } from './dto/invite-property-manager.dto';
import { AssignPropertyDto } from './dto/assign-property.dto';
import { EvictTenantDto } from './dto/evict-tenant.dto';
import { CreateNudgeDto } from './dto/nudge.dto';
import { UserRole } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InviteTenantDto } from '../users/dto/invite-tenant.dto';

@Injectable()
export class PropertyManagersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async invitePropertyManager(landlordId: string, actorUserId: string, dto: InvitePropertyManagerDto) {
    // Use the existing invite system
    await this.authService.sendInvite(landlordId, dto.email, UserRole.PROPERTY_MANAGER);

    // After invite is accepted, create property manager profile
    // This will be handled in the accept-invite flow

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: 'PROPERTY_MANAGER_INVITED',
        entityType: 'PROPERTY_MANAGER',
        entityId: landlordId,
        metadata: { email: dto.email, displayName: dto.displayName, title: dto.title },
      },
    });

    return { success: true, message: 'Property manager invitation sent' };
  }

  async inviteTenant(propertyManagerId: string, landlordId: string, dto: InviteTenantDto) {
    const assignment = await this.prisma.propertyManagerAssignment.findFirst({
      where: { propertyManagerId, propertyId: dto.propertyId },
      select: { id: true },
    });
    if (!assignment) {
      throw new BadRequestException('You are not assigned to this property.');
    }

    return this.authService.sendInvite(landlordId, dto.email, UserRole.TENANT, { propertyId: dto.propertyId });
  }

  async listPropertyManagers(landlordId: string) {
    return this.prisma.propertyManager.findMany({
      where: { landlordId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            status: true,
          },
        },
        assignedProperties: {
          include: {
            property: {
              select: {
                id: true,
                name: true,
                address: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async assignProperties(landlordId: string, propertyManagerId: string, dto: AssignPropertyDto) {
    // Verify property manager belongs to landlord
    const propertyManager = await this.prisma.propertyManager.findFirst({
      where: { id: propertyManagerId, landlordId },
    });
    if (!propertyManager) {
      throw new NotFoundException('Property manager not found');
    }

    // Verify all properties belong to landlord
    const properties = await this.prisma.property.findMany({
      where: {
        id: { in: dto.propertyIds },
        landlordId,
      },
    });
    if (properties.length !== dto.propertyIds.length) {
      throw new BadRequestException('Some properties do not belong to this landlord');
    }

    // Remove existing assignments
    await this.prisma.propertyManagerAssignment.deleteMany({
      where: { propertyManagerId },
    });

    // Create new assignments
    const assignments = await Promise.all(
      dto.propertyIds.map((propertyId) =>
        this.prisma.propertyManagerAssignment.create({
          data: {
            propertyManagerId,
            propertyId,
          },
        }),
      ),
    );

    await this.prisma.auditLog.create({
      data: {
        actorUserId: propertyManager.userId,
        action: 'PROPERTIES_ASSIGNED',
        entityType: 'PROPERTY_MANAGER',
        entityId: propertyManagerId,
        metadata: { propertyIds: dto.propertyIds },
      },
    });

    return assignments;
  }

  async removePropertyManager(landlordId: string, propertyManagerId: string, actorUserId: string) {
    const propertyManager = await this.prisma.propertyManager.findFirst({
      where: { id: propertyManagerId, landlordId },
    });
    if (!propertyManager) {
      throw new NotFoundException('Property manager not found');
    }

    // Remove all property assignments
    await this.prisma.propertyManagerAssignment.deleteMany({
      where: { propertyManagerId },
    });

    // Delete property manager profile
    await this.prisma.propertyManager.delete({
      where: { id: propertyManagerId },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: 'PROPERTY_MANAGER_REMOVED',
        entityType: 'PROPERTY_MANAGER',
        entityId: propertyManagerId,
      },
    });

    return { success: true };
  }

  async removeTenant(landlordId: string, tenantId: string, actorUserId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, landlordId },
      include: { leases: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Terminate all active leases
    await this.prisma.lease.updateMany({
      where: {
        tenantId,
        status: 'ACTIVE',
      },
      data: {
        status: 'TERMINATED',
      },
    });

    // Delete tenant profile
    await this.prisma.tenant.delete({
      where: { id: tenantId },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: 'TENANT_REMOVED',
        entityType: 'TENANT',
        entityId: tenantId,
      },
    });

    return { success: true };
  }

  async evictTenant(propertyManagerId: string, dto: EvictTenantDto) {
    const propertyManager = await this.prisma.propertyManager.findUnique({
      where: { id: propertyManagerId },
      include: {
        user: {
          select: {
            email: true,
          },
        },
        landlord: {
          include: { user: true },
        },
        assignedProperties: {
          include: { property: true },
        },
      },
    });
    if (!propertyManager) {
      throw new NotFoundException('Property manager not found');
    }

    // Verify tenant belongs to a property assigned to this property manager
    const lease = await this.prisma.lease.findUnique({
      where: { id: dto.leaseId },
      include: {
        unit: {
          include: { property: true },
        },
        tenant: {
          include: { user: true },
        },
      },
    });
    if (!lease) {
      throw new NotFoundException('Lease not found');
    }

    const hasAccess = propertyManager.assignedProperties.some(
      (assignment) => assignment.property.id === lease.unit.property.id,
    );
    if (!hasAccess) {
      throw new BadRequestException('Property manager does not have access to this property');
    }

    // Create eviction record
    const eviction = await this.prisma.tenantEviction.create({
      data: {
        propertyManagerId,
        tenantId: dto.tenantId,
        leaseId: dto.leaseId,
        reason: dto.reason,
        evictionDate: new Date(dto.evictionDate),
      },
    });

    // Terminate the lease
    await this.prisma.lease.update({
      where: { id: dto.leaseId },
      data: { status: 'TERMINATED' },
    });

    // Notify landlord
    await this.notificationsService.createNotification(propertyManager.landlord.userId, {
      type: 'TENANT_EVICTED',
      message: `Property manager ${propertyManager.displayName || propertyManager.user.email} evicted tenant ${lease.tenant.user.email} from ${lease.unit.property.name}`,
      metadata: {
        evictionId: eviction.id,
        tenantId: dto.tenantId,
        leaseId: dto.leaseId,
        propertyManagerId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: propertyManager.userId,
        action: 'TENANT_EVICTED',
        entityType: 'TENANT',
        entityId: dto.tenantId,
        metadata: { evictionId: eviction.id, reason: dto.reason },
      },
    });

    return eviction;
  }

  async createNudge(propertyManagerId: string, dto: CreateNudgeDto) {
    const propertyManager = await this.prisma.propertyManager.findUnique({
      where: { id: propertyManagerId },
      include: { landlord: { include: { user: true } } },
    });
    if (!propertyManager) {
      throw new NotFoundException('Property manager not found');
    }

    const nudge = await this.prisma.nudge.create({
      data: {
        propertyManagerId,
        type: dto.type,
        targetUserId: dto.targetUserId,
        invoiceId: dto.invoiceId,
        message: dto.message,
      },
    });

    // Create notification for target user
    if (dto.type === 'TENANT_PAYMENT') {
      await this.notificationsService.createNotification(dto.targetUserId, {
        type: 'PAYMENT_NUDGE',
        message: dto.message || 'Please make your rent payment',
        metadata: { nudgeId: nudge.id, invoiceId: dto.invoiceId },
      });
    } else if (dto.type === 'LANDLORD_RECEIPT') {
      await this.notificationsService.createNotification(propertyManager.landlord.userId, {
        type: 'RECEIPT_NUDGE',
        message: dto.message || 'Please issue receipt for payment',
        metadata: { nudgeId: nudge.id, invoiceId: dto.invoiceId },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        actorUserId: propertyManager.userId,
        action: 'NUDGE_CREATED',
        entityType: 'NUDGE',
        entityId: nudge.id,
        metadata: { type: dto.type, targetUserId: dto.targetUserId },
      },
    });

    return nudge;
  }

  async getAssignedProperties(propertyManagerId: string) {
    const assignments = await this.prisma.propertyManagerAssignment.findMany({
      where: { propertyManagerId },
      include: {
        property: {
          include: {
            units: {
              include: {
                leases: {
                  where: { status: 'ACTIVE' },
                  include: {
                    tenant: {
                      include: { user: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return assignments.map((assignment) => assignment.property);
  }

  async getAssignedTenants(propertyManagerId: string) {
    const properties = await this.getAssignedProperties(propertyManagerId);
    const allTenants: any[] = [];
    const tenantMap = new Map<string, any>();

    properties.forEach((property) => {
      property.units.forEach((unit) => {
        unit.leases.forEach((lease) => {
          if (lease.status === 'ACTIVE' && lease.tenant) {
            const tenantId = lease.tenant.id;
            if (!tenantMap.has(tenantId)) {
              tenantMap.set(tenantId, {
                id: lease.tenant.id,
                user: lease.tenant.user,
                leases: [],
              });
            }
            tenantMap.get(tenantId).leases.push({
              id: lease.id,
              status: lease.status,
              unit: {
                unitNumber: unit.unitNumber,
                property: {
                  name: property.name,
                },
              },
            });
          }
        });
      });
    });

    return Array.from(tenantMap.values());
  }

  async getAssignedComplaints(propertyManagerId: string) {
    const propertyManager = await this.prisma.propertyManager.findUnique({
      where: { id: propertyManagerId },
      include: {
        assignedProperties: {
          include: { property: true },
        },
      },
    });
    if (!propertyManager) {
      throw new NotFoundException('Property manager not found');
    }

    const propertyIds = propertyManager.assignedProperties.map((a) => a.propertyId);

    // Get complaints from tenants in assigned properties
    const complaints = await this.prisma.complaint.findMany({
      where: {
        lease: {
          unit: {
            propertyId: { in: propertyIds },
          },
        },
      },
      include: {
        tenant: {
          include: { user: true },
        },
        lease: {
          include: {
            unit: {
              include: { property: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return complaints;
  }

  async getDashboard(propertyManagerId: string) {
    const propertyManager = await this.prisma.propertyManager.findUnique({
      where: { id: propertyManagerId },
      include: {
        assignedProperties: {
          include: {
            property: {
              include: {
                units: {
                  include: {
                    leases: {
                      where: { status: 'ACTIVE' },
                      include: {
                        tenant: { include: { user: true } },
                        invoices: {
                          where: {
                            status: { in: ['PENDING', 'OVERDUE'] },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!propertyManager) {
      throw new NotFoundException('Property manager not found');
    }

    const properties = propertyManager.assignedProperties.map((a) => a.property);
    const totalUnits = properties.reduce((sum, p) => sum + p.units.length, 0);
    const occupiedUnits = properties.reduce(
      (sum, p) => sum + p.units.filter((u) => u.leases.length > 0).length,
      0,
    );
    const totalTenants = properties.reduce(
      (sum, p) => sum + p.units.reduce((s, u) => s + u.leases.length, 0),
      0,
    );
    const overdueInvoices = properties.reduce(
      (sum, p) => sum + p.units.reduce((s, u) => s + u.leases.reduce((ss, l) => ss + l.invoices.length, 0), 0),
      0,
    );

    return {
      properties: properties.length,
      totalUnits,
      occupiedUnits,
      occupancyRate: totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0,
      totalTenants,
      overdueInvoices,
    };
  }
}

