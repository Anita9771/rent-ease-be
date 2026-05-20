import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceStatus } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getDashboard(@CurrentUser('landlordId') landlordId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get all invoices for this landlord
    const invoices = await this.prisma.rentInvoice.findMany({
      where: {
        lease: {
          landlordId,
        },
      },
      include: {
        lease: {
          include: {
            tenant: {
              include: { user: true },
            },
            unit: {
              include: { property: true },
            },
          },
        },
        payments: true,
      },
    });

    // Calculate metrics
    const thisMonthInvoices = invoices.filter(
      (inv) => new Date(inv.dueDate) >= startOfMonth,
    );
    const lastMonthInvoices = invoices.filter(
      (inv) =>
        new Date(inv.dueDate) >= lastMonth &&
        new Date(inv.dueDate) <= endOfLastMonth,
    );

    const thisMonthCollected = thisMonthInvoices
      .filter((inv) => inv.status === InvoiceStatus.PAID)
      .reduce((sum, inv) => {
        const paid = inv.payments.reduce(
          (pSum, p) => pSum + Number(p.amount),
          0,
        );
        return sum + paid;
      }, 0);

    const lastMonthCollected = lastMonthInvoices
      .filter((inv) => inv.status === InvoiceStatus.PAID)
      .reduce((sum, inv) => {
        const paid = inv.payments.reduce(
          (pSum, p) => pSum + Number(p.amount),
          0,
        );
        return sum + paid;
      }, 0);

    const outstandingBalance = invoices
      .filter(
        (inv) =>
          inv.status === InvoiceStatus.PENDING ||
          inv.status === InvoiceStatus.OVERDUE,
      )
      .reduce((sum, inv) => {
        const paid = inv.payments.reduce(
          (pSum, p) => pSum + Number(p.amount),
          0,
        );
        return sum + Number(inv.amountDue) - paid;
      }, 0);

    const lastMonthOutstanding = lastMonthInvoices
      .filter(
        (inv) =>
          inv.status === InvoiceStatus.PENDING ||
          inv.status === InvoiceStatus.OVERDUE,
      )
      .reduce((sum, inv) => {
        const paid = inv.payments.reduce(
          (pSum, p) => pSum + Number(p.amount),
          0,
        );
        return sum + Number(inv.amountDue) - paid;
      }, 0);

    // Get properties and units
    const properties = await this.prisma.property.findMany({
      where: { landlordId },
      include: {
        units: {
          include: {
            leases: {
              where: {
                status: 'ACTIVE',
              },
            },
          },
        },
      },
    });

    const totalUnits = properties.reduce((sum, p) => sum + p.units.length, 0);
    const occupiedUnits = properties.reduce(
      (sum, p) => sum + p.units.filter((u) => u.leases.length > 0).length,
      0,
    );
    const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

    // Get complaints
    const complaints = await this.prisma.complaint.findMany({
      where: { landlordId },
      include: {
        tenant: {
          include: { user: true },
        },
      },
    });

    const openComplaints = complaints.filter((c) => c.status === 'OPEN').length;
    const urgentComplaints = complaints.filter((c) => c.priority === 'URGENT').length;

    // Get upcoming invoices
    const upcomingInvoices = invoices
      .filter(
        (inv) =>
          (inv.status === InvoiceStatus.PENDING ||
            inv.status === InvoiceStatus.OVERDUE) &&
          new Date(inv.dueDate) <=
            new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      )
      .slice(0, 5)
      .map((inv) => ({
        id: inv.id,
        tenant: inv.lease.tenant.user.email.split('@')[0],
        unit: `${inv.lease.unit.property.name} • ${inv.lease.unit.unitNumber}`,
        dueDate: inv.dueDate,
        amount: Number(inv.amountDue),
        status: inv.status,
      }));

    // Calculate rent collection timeline (weekly percentages)
    const rentTimeline = [];
    for (let week = 1; week <= 4; week++) {
      const weekStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        (week - 1) * 7 + 1,
      );
      const weekEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        week * 7,
      );
      const weekInvoices = thisMonthInvoices.filter(
        (inv) =>
          new Date(inv.dueDate) >= weekStart &&
          new Date(inv.dueDate) <= weekEnd,
      );
      const weekPaid =
        weekInvoices.filter((inv) => inv.status === InvoiceStatus.PAID)
          .length / (weekInvoices.length || 1);
      rentTimeline.push(Math.round(weekPaid * 100));
    }

    const trend =
      lastMonthCollected > 0
        ? ((thisMonthCollected - lastMonthCollected) / lastMonthCollected) * 100
        : 0;
    const outstandingTrend =
      lastMonthOutstanding > 0
        ? ((outstandingBalance - lastMonthOutstanding) / lastMonthOutstanding) *
          100
        : 0;

    return {
      metrics: {
        rentCollected: {
          value: thisMonthCollected,
          trend: trend > 0 ? `+${trend.toFixed(0)}%` : `${trend.toFixed(0)}%`,
        },
        outstandingBalance: {
          value: outstandingBalance,
          trend: outstandingTrend > 0
            ? `+${outstandingTrend.toFixed(0)}%`
            : `${outstandingTrend.toFixed(0)}%`,
        },
        occupancyRate: {
          value: occupancyRate,
          occupied: occupiedUnits,
          total: totalUnits,
        },
        openComplaints: {
          value: openComplaints,
          urgent: urgentComplaints,
        },
      },
      rentTimeline,
      upcomingInvoices,
    };
  }
}

