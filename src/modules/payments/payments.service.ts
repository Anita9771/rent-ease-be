import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InitiatePaymentDto, PaymentMethod } from './dto/initiate-payment.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async initiatePayment(tenantId: string, actorUserId: string, dto: InitiatePaymentDto) {
    const invoice = await this.prisma.rentInvoice.findFirst({
      where: { id: dto.invoiceId, tenantId },
      include: { landlord: true },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found for tenant');
    }
    if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Invoice already settled');
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          rentInvoiceId: invoice.id,
          tenantId,
          amount: new Prisma.Decimal(dto.amount),
          method: dto.method,
          externalTxnId: dto.reference,
          receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : new Date(),
          status: dto.method === PaymentMethod.CARD ? PaymentStatus.PENDING_CONFIRMATION : PaymentStatus.PENDING_CONFIRMATION,
          notes: dto.notes,
        },
        include: {
          invoice: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: 'PAYMENT_INITIATED',
          entityType: 'PAYMENT',
          entityId: created.id,
          metadata: {
            invoiceId: invoice.id,
            amount: created.amount,
            method: dto.method,
          },
        },
      });

      return created;
    });

    return payment;
  }

  async confirmPayment(landlordId: string, actorUserId: string, paymentId: string, dto: ConfirmPaymentDto) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, invoice: { landlordId } },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status === PaymentStatus.CONFIRMED) {
      throw new BadRequestException('Payment already confirmed');
    }

    const confirmed = await this.prisma.$transaction(async (tx) => {
      const invoiceBefore = await tx.rentInvoice.findUnique({
        where: { id: payment.rentInvoiceId },
      });
      if (!invoiceBefore) {
        throw new NotFoundException('Invoice not found');
      }

      const newAmountPaid = invoiceBefore.amountPaid.plus(payment.amount);
      const status = newAmountPaid.greaterThanOrEqualTo(invoiceBefore.amountDue) ? InvoiceStatus.PAID : InvoiceStatus.PARTIAL;

      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.CONFIRMED,
          confirmedByLandlordId: landlordId,
          notes: dto.note ?? payment.notes,
        },
      });

      const invoice = await tx.rentInvoice.update({
        where: { id: payment.rentInvoiceId },
        data: {
          amountPaid: newAmountPaid,
          status,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: 'PAYMENT_CONFIRMED',
          entityType: 'PAYMENT',
          entityId: paymentId,
          metadata: { invoiceId: invoice.id },
        },
      });

      return { updatedPayment, invoice };
    });

    return confirmed;
  }

  listForLandlord(landlordId: string) {
    return this.prisma.payment.findMany({
      where: { invoice: { landlordId } },
      include: {
        invoice: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  listForTenant(tenantId: string) {
    return this.prisma.payment.findMany({
      where: { tenantId },
      include: {
        invoice: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async handleStripeWebhook(event: any) {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const invoiceId = session.metadata?.rentInvoiceId;
      if (!invoiceId) {
        return;
      }
      await this.prisma.payment.updateMany({
        where: { rentInvoiceId: invoiceId, externalTxnId: session.id },
        data: { status: PaymentStatus.CONFIRMED },
      });
    }
  }

  async getPaymentMethods(tenantId: string) {
    // For now, return mock payment methods. In production, this would be stored in a PaymentMethod table
    // or in tenant metadata
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    // Return mock data - in production, fetch from PaymentMethod table or tenant metadata
    return [
      { id: '1', type: 'CARD', last4: '2244', brand: 'Visa', isDefault: true },
    ];
  }

  async addPaymentMethod(tenantId: string, userId: string, dto: { type: string; last4?: string; brand?: string }) {
    // For now, just return success. In production, create a PaymentMethod record
    await this.prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: 'PAYMENT_METHOD_ADDED',
        entityType: 'TENANT',
        entityId: tenantId,
        metadata: dto,
      },
    });
    return { success: true, id: `pm_${Date.now()}` };
  }
}

