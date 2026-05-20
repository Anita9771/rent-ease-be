import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(landlordId: string, actorUserId: string, dto: CreateExpenseDto) {
    if (dto.propertyId) {
      await this.ensurePropertyBelongsToLandlord(dto.propertyId, landlordId);
    }
    if (dto.unitId) {
      await this.ensureUnitBelongsToLandlord(dto.unitId, landlordId);
    }

    const expense = await this.prisma.expense.create({
      data: {
        landlordId,
        propertyId: dto.propertyId,
        unitId: dto.unitId,
        amount: new Prisma.Decimal(dto.amount),
        category: dto.category,
        description: dto.description,
        incurredAt: new Date(dto.incurredAt),
        receiptUrl: dto.receiptUrl,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: 'EXPENSE_RECORDED',
        entityType: 'EXPENSE',
        entityId: expense.id,
        metadata: {
          amount: expense.amount,
          category: expense.category,
        },
      },
    });

    return expense;
  }

  findAll(landlordId: string) {
    return this.prisma.expense.findMany({
      where: { landlordId },
      include: {
        property: true,
        unit: true,
      },
      orderBy: { incurredAt: 'desc' },
    });
  }

  async findOne(landlordId: string, expenseId: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, landlordId },
      include: { property: true, unit: true },
    });
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }
    return expense;
  }

  async update(landlordId: string, actorUserId: string, expenseId: string, dto: UpdateExpenseDto) {
    await this.findOne(landlordId, expenseId);
    const expense = await this.prisma.expense.update({
      where: { id: expenseId },
      data: {
        propertyId: dto.propertyId,
        unitId: dto.unitId,
        amount: dto.amount ? new Prisma.Decimal(dto.amount) : undefined,
        category: dto.category,
        description: dto.description,
        incurredAt: dto.incurredAt ? new Date(dto.incurredAt) : undefined,
        receiptUrl: dto.receiptUrl,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: 'EXPENSE_UPDATED',
        entityType: 'EXPENSE',
        entityId: expense.id,
      },
    });

    return expense;
  }

  async remove(landlordId: string, actorUserId: string, expenseId: string) {
    await this.findOne(landlordId, expenseId);
    await this.prisma.expense.delete({ where: { id: expenseId } });
    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: 'EXPENSE_DELETED',
        entityType: 'EXPENSE',
        entityId: expenseId,
      },
    });
    return { success: true };
  }

  async getSummary(landlordId: string, year: number) {
    const expenses = await this.prisma.expense.groupBy({
      by: ['category'],
      where: {
        landlordId,
        incurredAt: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`),
        },
      },
      _sum: { amount: true },
    });

    return expenses.map((item) => ({
      category: item.category,
      total: item._sum.amount?.toNumber() ?? 0,
    }));
  }

  private async ensurePropertyBelongsToLandlord(propertyId: string, landlordId: string) {
    const property = await this.prisma.property.findFirst({ where: { id: propertyId, landlordId } });
    if (!property) {
      throw new BadRequestException('Property not found for landlord');
    }
  }

  async exportRentRoll(landlordId: string) {
    const leases = await this.prisma.lease.findMany({
      where: { landlordId, status: 'ACTIVE' },
      include: {
        tenant: {
          include: { user: true },
        },
        unit: {
          include: { property: true },
        },
        invoices: {
          where: {
            status: { in: ['PENDING', 'OVERDUE'] },
          },
          orderBy: { dueDate: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return leases.map((lease) => ({
      tenant: {
        name: lease.tenant.user.email.split('@')[0],
        email: lease.tenant.user.email,
        phone: lease.tenant.primaryContactPhone,
      },
      property: {
        name: lease.unit.property.name,
        address: lease.unit.property.address,
      },
      unit: {
        number: lease.unit.unitNumber,
        bedrooms: lease.unit.bedrooms,
        squareFeet: lease.unit.squareFeet,
      },
      lease: {
        startDate: lease.startDate,
        endDate: lease.endDate,
        rentAmount: Number(lease.rentAmount),
        rentFrequency: lease.rentFrequency,
        status: lease.status,
      },
      outstandingBalance: lease.invoices.length > 0 ? Number(lease.invoices[0].amountDue) - Number(lease.invoices[0].amountPaid) : 0,
    }));
  }

  private async ensureUnitBelongsToLandlord(unitId: string, landlordId: string) {
    const unit = await this.prisma.unit.findFirst({
      where: { id: unitId, property: { landlordId } },
    });
    if (!unit) {
      throw new BadRequestException('Unit not found for landlord');
    }
  }
}

