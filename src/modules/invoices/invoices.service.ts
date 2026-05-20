import { Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { ListInvoicesDto } from './dto/list-invoices.dto';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async createManual(landlordId: string, actorUserId: string, dto: CreateInvoiceDto) {
    await this.ensureLeaseAndTenant(landlordId, dto.leaseId, dto.tenantId);
    const lease = await this.prisma.lease.findUnique({ where: { id: dto.leaseId } });
    if (!lease) {
      throw new NotFoundException('Lease not found');
    }

    const invoice = await this.prisma.$transaction(async (tx) => {
      const created = await tx.rentInvoice.create({
        data: {
          landlordId,
          leaseId: dto.leaseId,
          tenantId: dto.tenantId,
          periodStart: dto.periodStart,
          periodEnd: dto.periodEnd,
          dueDate: dto.dueDate,
          amountDue: new Prisma.Decimal(dto.amountDue ?? lease.rentAmount),
          status: InvoiceStatus.PENDING,
          metadata: dto.memo
            ? {
                memo: dto.memo,
              }
            : undefined,
        },
        include: {
          tenant: { include: { user: true } },
          lease: { include: { unit: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: 'INVOICE_CREATED',
          entityType: 'RENT_INVOICE',
          entityId: created.id,
          metadata: {
            leaseId: dto.leaseId,
            tenantId: dto.tenantId,
            amountDue: created.amountDue,
          },
        },
      });

      return created;
    });

    return invoice;
  }

  listForLandlord(landlordId: string, query: ListInvoicesDto) {
    return this.prisma.rentInvoice.findMany({
      where: {
        landlordId,
        status: query.status,
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
        payments: true,
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  listForTenant(tenantId: string, query: ListInvoicesDto) {
    return this.prisma.rentInvoice.findMany({
      where: {
        tenantId,
        status: query.status,
      },
      include: {
        lease: { include: { unit: { include: { property: true } } } },
        payments: true,
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async listForPropertyManager(propertyManagerId: string, query: ListInvoicesDto) {
    // Get assigned properties for this property manager
    const assignments = await this.prisma.propertyManagerAssignment.findMany({
      where: { propertyManagerId },
      select: { propertyId: true },
    });
    const propertyIds = assignments.map((a) => a.propertyId);

    if (propertyIds.length === 0) {
      return [];
    }

    // Get invoices from leases in assigned properties
    return this.prisma.rentInvoice.findMany({
      where: {
        lease: {
          unit: {
            propertyId: { in: propertyIds },
          },
        },
        status: query.status,
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
        payments: true,
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async getInvoice(landlordId: string, invoiceId: string) {
    const invoice = await this.prisma.rentInvoice.findFirst({
      where: { id: invoiceId, landlordId },
      include: {
        tenant: { include: { user: true } },
        lease: { include: { unit: { include: { property: true } } } },
        payments: true,
      },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  async getInvoiceForTenant(tenantId: string, invoiceId: string) {
    const invoice = await this.prisma.rentInvoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: {
        lease: { include: { unit: { include: { property: true } } } },
        payments: true,
      },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  async getInvoiceForPropertyManager(propertyManagerId: string, invoiceId: string) {
    // Get assigned properties
    const assignments = await this.prisma.propertyManagerAssignment.findMany({
      where: { propertyManagerId },
      select: { propertyId: true },
    });
    const propertyIds = assignments.map((a) => a.propertyId);

    if (propertyIds.length === 0) {
      throw new NotFoundException('Invoice not found');
    }

    const invoice = await this.prisma.rentInvoice.findFirst({
      where: {
        id: invoiceId,
        lease: {
          unit: {
            propertyId: { in: propertyIds },
          },
        },
      },
      include: {
        tenant: { include: { user: true } },
        lease: { include: { unit: { include: { property: true } } } },
        payments: true,
      },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  async markOverdue(invoiceId: string) {
    return this.prisma.rentInvoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.OVERDUE },
    });
  }

  async generateInvoicesForActiveLeases(landlordId: string, actorUserId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const dueDate = new Date(now.getFullYear(), now.getMonth(), 5); // Due on 5th of next month

    // Get all active leases for this landlord
    const activeLeases = await this.prisma.lease.findMany({
      where: {
        landlordId,
        status: 'ACTIVE',
      },
      include: {
        tenant: { include: { user: true } },
      },
    });

    const generatedInvoices = [];

    for (const lease of activeLeases) {
      // Check if invoice already exists for this period
      const existingInvoice = await this.prisma.rentInvoice.findFirst({
        where: {
          leaseId: lease.id,
          periodStart: startOfMonth,
          periodEnd: endOfMonth,
        },
      });

      if (existingInvoice) {
        continue; // Skip if invoice already exists
      }

      const invoice = await this.prisma.$transaction(async (tx) => {
        const created = await tx.rentInvoice.create({
          data: {
            landlordId,
            leaseId: lease.id,
            tenantId: lease.tenantId,
            periodStart: startOfMonth,
            periodEnd: endOfMonth,
            dueDate,
            amountDue: lease.rentAmount,
            status: InvoiceStatus.PENDING,
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId,
            action: 'INVOICE_CREATED',
            entityType: 'RENT_INVOICE',
            entityId: created.id,
            metadata: {
              leaseId: lease.id,
              tenantId: lease.tenantId,
              amountDue: created.amountDue,
              generated: true,
            },
          },
        });

        return created;
      });

      generatedInvoices.push(invoice);
    }

    return {
      success: true,
      count: generatedInvoices.length,
      invoices: generatedInvoices,
    };
  }

  async sendReminder(invoiceId: string, actorUserId?: string, channel: string = 'email') {
    const invoice = await this.prisma.rentInvoice.findUnique({
      where: { id: invoiceId },
      include: { tenant: { include: { user: true } } },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    await this.prisma.notification.create({
      data: {
        userId: invoice.tenant.user.id,
        type: 'RENT_REMINDER',
        payload: {
          invoiceId: invoice.id,
          amountDue: invoice.amountDue,
          dueDate: invoice.dueDate,
          channel,
        },
      },
    });

    if (actorUserId) {
      await this.prisma.auditLog.create({
        data: {
          actorUserId,
          action: 'INVOICE_REMINDER_SENT',
          entityType: 'RENT_INVOICE',
          entityId: invoice.id,
          metadata: { channel },
        },
      });
    }

    return { success: true };
  }

  private async ensureLeaseAndTenant(landlordId: string, leaseId: string, tenantId: string) {
    const lease = await this.prisma.lease.findFirst({
      where: { id: leaseId, landlordId, tenantId },
    });
    if (!lease) {
      throw new NotFoundException('Lease does not belong to landlord/tenant');
    }
  }
}

