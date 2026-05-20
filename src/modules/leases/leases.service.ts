import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeaseDto, LeaseStatus } from './dto/create-lease.dto';
import { UpdateLeaseStatusDto } from './dto/update-lease-status.dto';

@Injectable()
export class LeasesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(landlordId: string, actorUserId: string, dto: CreateLeaseDto) {
    await this.ensureTenantBelongsToLandlord(dto.tenantId, landlordId);
    await this.ensureUnitBelongsToLandlord(dto.unitId, landlordId);

    const overlappingLease = await this.prisma.lease.findFirst({
      where: {
        unitId: dto.unitId,
        status: { in: [LeaseStatus.ACTIVE, LeaseStatus.PENDING] },
        NOT: {
          OR: [
            { endDate: { lt: new Date(dto.startDate) } },
            { startDate: { gt: new Date(dto.endDate) } },
          ],
        },
      },
    });

    if (overlappingLease) {
      throw new BadRequestException('Unit already has an active lease during the selected period.');
    }

    const lease = await this.prisma.$transaction(async (tx) => {
      const createdLease = await tx.lease.create({
        data: {
          landlordId,
          tenantId: dto.tenantId,
          unitId: dto.unitId,
          startDate: dto.startDate,
          endDate: dto.endDate,
          rentAmount: new Prisma.Decimal(dto.rentAmount),
          rentFrequency: dto.rentFrequency,
          lateFeeType: dto.lateFeeType,
          lateFeeValue: dto.lateFeeValue ? new Prisma.Decimal(dto.lateFeeValue) : undefined,
          depositAmount: dto.depositAmount ? new Prisma.Decimal(dto.depositAmount) : undefined,
          status: dto.status ?? LeaseStatus.ACTIVE,
          memo: dto.memo,
        },
        include: {
          tenant: { include: { user: true } },
          unit: { include: { property: true } },
        },
      });

      if (createdLease.status === LeaseStatus.ACTIVE) {
        await tx.unit.update({
          where: { id: dto.unitId },
          data: { status: 'OCCUPIED' },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: 'LEASE_CREATED',
          entityType: 'LEASE',
          entityId: createdLease.id,
          metadata: {
            tenantId: dto.tenantId,
            unitId: dto.unitId,
            startDate: dto.startDate,
            endDate: dto.endDate,
          },
        },
      });

      return createdLease;
    });

    return lease;
  }

  findAllByLandlord(landlordId: string) {
    return this.prisma.lease.findMany({
      where: { landlordId },
      include: {
        tenant: { include: { user: true } },
        unit: { include: { property: true } },
        invoices: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findAllByTenant(tenantId: string) {
    return this.prisma.lease.findMany({
      where: { tenantId },
      include: {
        unit: { include: { property: true } },
        invoices: true,
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async getTenantDocuments(tenantId: string) {
    const leases = await this.prisma.lease.findMany({
      where: { tenantId },
      include: {
        documents: {
          orderBy: { uploadedAt: 'desc' },
        },
        unit: {
          include: { property: true },
        },
      },
    });

    const allDocuments = leases.flatMap((lease) =>
      lease.documents.map((doc) => ({
        id: doc.id,
        name: `${lease.unit.property.name} - ${doc.docType}`,
        type: doc.docType,
        url: doc.documentUrl,
        uploadedAt: doc.uploadedAt,
        leaseId: lease.id,
      })),
    );

    return allDocuments;
  }

  async findOneByTenant(tenantId: string, leaseId: string) {
    const lease = await this.prisma.lease.findFirst({
      where: { id: leaseId, tenantId },
      include: {
        tenant: { include: { user: true } },
        unit: { include: { property: true } },
        invoices: true,
        documents: true,
      },
    });

    if (!lease) {
      throw new NotFoundException('Lease not found');
    }

    return lease;
  }

  async findOne(landlordId: string, leaseId: string) {
    const lease = await this.prisma.lease.findFirst({
      where: { id: leaseId, landlordId },
      include: {
        tenant: { include: { user: true } },
        unit: { include: { property: true } },
        invoices: true,
        documents: true,
        complaints: true,
      },
    });

    if (!lease) {
      throw new NotFoundException('Lease not found');
    }

    return lease;
  }

  async updateStatus(landlordId: string, actorUserId: string, leaseId: string, dto: UpdateLeaseStatusDto) {
    await this.ensureLeaseBelongsToLandlord(leaseId, landlordId);
    const updatedLease = await this.prisma.$transaction(async (tx) => {
      const lease = await tx.lease.update({
        where: { id: leaseId },
        data: {
          status: dto.status,
          updatedAt: new Date(),
        },
      });

      if ([LeaseStatus.TERMINATED, LeaseStatus.COMPLETED].includes(dto.status)) {
        await tx.unit.update({
          where: { id: lease.unitId },
          data: { status: 'AVAILABLE' },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: 'LEASE_STATUS_UPDATED',
          entityType: 'LEASE',
          entityId: leaseId,
          metadata: { status: dto.status },
        },
      });

      return lease;
    });

    return updatedLease;
  }

  async attachDocument(landlordId: string, actorUserId: string, leaseId: string, documentUrl: string, docType: string) {
    await this.ensureLeaseBelongsToLandlord(leaseId, landlordId);
    const document = await this.prisma.leaseDocument.create({
      data: {
        leaseId,
        documentUrl,
        docType,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: 'LEASE_DOCUMENT_ATTACHED',
        entityType: 'LEASE',
        entityId: leaseId,
        metadata: { docType, documentUrl },
      },
    });

    return document;
  }

  private async ensureTenantBelongsToLandlord(tenantId: string, landlordId: string) {
    const tenant = await this.prisma.tenant.findFirst({ where: { id: tenantId, landlordId } });
    if (!tenant) {
      throw new BadRequestException('Tenant does not belong to landlord');
    }
  }

  private async ensureUnitBelongsToLandlord(unitId: string, landlordId: string) {
    const unit = await this.prisma.unit.findFirst({
      where: { id: unitId, property: { landlordId } },
    });
    if (!unit) {
      throw new BadRequestException('Unit does not belong to landlord');
    }
  }

  private async ensureLeaseBelongsToLandlord(leaseId: string, landlordId: string) {
    const lease = await this.prisma.lease.findFirst({ where: { id: leaseId, landlordId } });
    if (!lease) {
      throw new NotFoundException('Lease not found');
    }
  }
}

