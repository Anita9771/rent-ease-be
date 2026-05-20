import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { AuthService } from '../auth/auth.service';
import { Prisma, UserRole } from '@prisma/client';
import { InviteTenantDto } from './dto/invite-tenant.dto';
import { PrismaService } from '../prisma/prisma.service';

const tenantProfileInclude = {
  user: { select: { email: true } },
  property: {
    select: {
      id: true,
      name: true,
      address: true,
    },
  },
  leases: {
    include: {
      unit: {
        include: {
          property: {
            select: { id: true, name: true, address: true },
          },
        },
      },
    },
    orderBy: { createdAt: Prisma.SortOrder.desc },
  },
  invoices: {
    orderBy: { dueDate: Prisma.SortOrder.desc },
    take: 8,
  },
  payments: {
    orderBy: { receivedAt: Prisma.SortOrder.desc },
    take: 8,
  },
  complaints: {
    orderBy: { createdAt: Prisma.SortOrder.desc },
    take: 5,
  },
} satisfies Prisma.TenantInclude;

type TenantWithProfile = Prisma.TenantGetPayload<{ include: typeof tenantProfileInclude }>;

@UseGuards(JwtAuthGuard)
@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async list(@CurrentUser('landlordId') landlordId: string) {
    const tenants = await this.usersService.listLandlordTenants(landlordId);
    return tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.user.email.split('@')[0], // Fallback to email prefix
      email: tenant.user.email,
      phone: tenant.primaryContactPhone,
      avatarUrl: tenant.avatarUrl,
      status: tenant.leases.length > 0 ? 'Active' : 'Invited',
      createdAt: tenant.createdAt,
      property: tenant.property
        ? {
            id: tenant.property.id,
            name: tenant.property.name,
            address: tenant.property.address,
          }
        : null,
      leases: tenant.leases.map((lease) => ({
        id: lease.id,
        unitId: lease.unitId,
        unit: lease.unit
          ? {
              id: lease.unit.id,
              unitNumber: lease.unit.unitNumber,
              property: lease.unit.property
                ? {
                    id: lease.unit.property.id,
                    name: lease.unit.property.name,
                    address: lease.unit.property.address,
                  }
                : null,
            }
          : null,
        startDate: lease.startDate,
        endDate: lease.endDate,
        status: lease.status,
      })),
    }));
  }

  @Post('invite')
  async invite(@CurrentUser('landlordId') landlordId: string, @Body() dto: InviteTenantDto) {
    const property = await this.prisma.property.findFirst({
      where: { id: dto.propertyId, landlordId },
      select: { id: true },
    });
    if (!property) {
      throw new BadRequestException('Property not found for this landlord.');
    }

    return this.authService.sendInvite(landlordId, dto.email, UserRole.TENANT, { propertyId: dto.propertyId });
  }

  @Get(':tenantId')
  async getTenantProfile(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: any,
    @CurrentUser('landlordId') landlordId: string | undefined,
    @CurrentUser('propertyManagerId') propertyManagerId: string | undefined,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    if (user.role === UserRole.LANDLORD) {
      if (!landlordId) {
        throw new ForbiddenException('Not authorized');
      }
      const tenant = await this.prisma.tenant.findFirst({
        where: { id: tenantId, landlordId },
        include: tenantProfileInclude,
      });
      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }
      return this.mapTenantProfile(tenant);
    }

    if (user.role === UserRole.PROPERTY_MANAGER) {
      if (!propertyManagerId) {
        throw new ForbiddenException('Not authorized');
      }
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        include: tenantProfileInclude,
      });
      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }

      const propertyIds = [
        tenant.propertyId,
        ...tenant.leases
          .map((lease) => lease.unit?.propertyId)
          .filter((id): id is string => Boolean(id)),
      ].filter(Boolean) as string[];

      if (propertyIds.length === 0) {
        throw new ForbiddenException('You do not have access to this tenant');
      }

      const assignment = await this.prisma.propertyManagerAssignment.findFirst({
        where: {
          propertyManagerId,
          propertyId: { in: propertyIds },
        },
      });

      if (!assignment) {
        throw new ForbiddenException('You do not have access to this tenant');
      }

      return this.mapTenantProfile(tenant);
    }

    throw new ForbiddenException('Not authorized');
  }

  private mapTenantProfile(tenant: TenantWithProfile) {
    return {
      id: tenant.id,
      email: tenant.user.email,
      name: tenant.user.email.split('@')[0],
      avatarUrl: tenant.avatarUrl,
      phone: tenant.primaryContactPhone,
      emergencyContact: tenant.emergencyContact,
      property: tenant.property
        ? {
            id: tenant.property.id,
            name: tenant.property.name,
            address: tenant.property.address,
          }
        : null,
      leases: tenant.leases.map((lease) => ({
        id: lease.id,
        status: lease.status,
        startDate: lease.startDate,
        endDate: lease.endDate,
        rentAmount: lease.rentAmount ? Number(lease.rentAmount) : null,
        unit: lease.unit
          ? {
              unitNumber: lease.unit.unitNumber,
              property: lease.unit.property
                ? {
                    name: lease.unit.property.name,
                    address: lease.unit.property.address,
                  }
                : null,
            }
          : null,
      })),
      invoices: tenant.invoices.map((invoice) => ({
        id: invoice.id,
        dueDate: invoice.dueDate,
        amountDue: invoice.amountDue ? Number(invoice.amountDue) : null,
        amountPaid: invoice.amountPaid ? Number(invoice.amountPaid) : null,
        status: invoice.status,
      })),
      payments: tenant.payments.map((payment) => ({
        id: payment.id,
        amount: payment.amount ? Number(payment.amount) : null,
        method: payment.method,
        status: payment.status,
        receivedAt: payment.receivedAt,
      })),
      complaints: tenant.complaints.map((complaint) => ({
        id: complaint.id,
        title: complaint.title,
        status: complaint.status,
        priority: complaint.priority,
        createdAt: complaint.createdAt,
      })),
      createdAt: tenant.createdAt,
    };
  }
}

