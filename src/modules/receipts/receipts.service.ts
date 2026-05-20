import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type ReceiptPayload = {
  receiptNumber: string;
  issuedAt: string;
  landlord: {
    name: string;
    email: string;
  };
  tenant: {
    name: string;
    email: string;
  };
  property: {
    name: string;
    address: string;
  };
  leasePeriod: {
    start: string;
    end: string;
  };
  payment: {
    amount: string;
    method: string;
    receivedAt: string;
  };
};

@Injectable()
export class ReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

  async generateReceipt(paymentId: string, actorUserId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        tenant: {
          include: {
            user: true,
          },
        },
        invoice: {
          include: {
            lease: {
              include: {
                unit: {
                  include: {
                    property: true,
                  },
                },
                landlord: {
                  include: {
                    user: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const lease = payment.invoice.lease;
    const receipt: ReceiptPayload = {
      receiptNumber: `REC-${payment.createdAt.getFullYear()}-${payment.id.slice(0, 8).toUpperCase()}`,
      issuedAt: new Date().toISOString(),
      landlord: {
        name: lease.landlord.user.email,
        email: lease.landlord.user.email,
      },
      tenant: {
        name: payment.tenant.user.email,
        email: payment.tenant.user.email,
      },
      property: {
        name: lease.unit.property.name,
        address: lease.unit.property.address,
      },
      leasePeriod: {
        start: lease.startDate.toISOString(),
        end: lease.endDate.toISOString(),
      },
      payment: {
        amount: payment.amount.toString(),
        method: payment.method,
        receivedAt: payment.receivedAt.toISOString(),
      },
    };

    const receiptHtml = this.buildReceiptHtml(receipt);
    const encoded = Buffer.from(receiptHtml).toString('base64');
    const dataUrl = `data:text/html;base64,${encoded}`;

    const updatedPayment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { receiptUrl: dataUrl },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: 'RECEIPT_GENERATED',
        entityType: 'PAYMENT',
        entityId: paymentId,
        metadata: {
          receiptNumber: receipt.receiptNumber,
        },
      },
    });

    return {
      receipt,
      previewUrl: updatedPayment.receiptUrl,
    };
  }

  async listForTenant(tenantId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { tenantId, receiptUrl: { not: null } },
      include: {
        invoice: {
          include: {
            lease: {
              include: {
                unit: {
                  include: { property: true },
                },
              },
            },
          },
        },
      },
      orderBy: { receivedAt: 'desc' },
    });

    return payments.map((payment) => ({
      id: payment.id,
      receiptNumber: payment.receiptUrl ? `REC-${payment.receivedAt.getFullYear()}-${payment.id.slice(0, 8).toUpperCase()}` : null,
      amount: Number(payment.amount),
      receivedAt: payment.receivedAt.toISOString(),
      invoice: {
        id: payment.invoice.id,
        period: `${payment.invoice.periodStart.toLocaleDateString('en-US', { month: 'short' })} - ${payment.invoice.periodEnd.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
      },
    }));
  }

  async getReceipt(paymentId: string, tenantId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, tenantId },
      include: { invoice: true },
    });
    if (!payment) {
      throw new NotFoundException('Receipt not found');
    }
    return {
      receiptUrl: payment.receiptUrl,
      invoice: payment.invoice,
    };
  }

  private buildReceiptHtml(receipt: ReceiptPayload) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Rent Receipt ${receipt.receiptNumber}</title>
        <style>
          body { font-family: Inter, Arial, sans-serif; padding: 32px; color: #0F2D3F; background: #F3F5F7; }
          header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
          h1 { margin: 0; font-size: 28px; }
          .section { background: #fff; border-radius: 16px; padding: 24px; margin-bottom: 16px; box-shadow: 0 16px 32px rgba(15,45,63,0.08); }
          .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #9AA6B2; margin-bottom: 4px; }
          .value { font-size: 16px; font-weight: 600; }
          .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
        </style>
      </head>
      <body>
        <header>
          <div>
            <div class="label">Receipt</div>
            <h1>${receipt.receiptNumber}</h1>
          </div>
          <div class="value">${new Date(receipt.issuedAt).toLocaleDateString()}</div>
        </header>
        <section class="section">
          <div class="label">Landlord</div>
          <div class="value">${receipt.landlord.name}</div>
          <div>${receipt.landlord.email}</div>
        </section>
        <section class="section">
          <div class="label">Tenant</div>
          <div class="value">${receipt.tenant.name}</div>
          <div>${receipt.tenant.email}</div>
        </section>
        <section class="section">
          <div class="label">Property</div>
          <div class="value">${receipt.property.name}</div>
          <div>${receipt.property.address}</div>
        </section>
        <section class="section">
          <div class="label">Lease Period</div>
          <div class="grid">
            <div>
              <div class="label">Start</div>
              <div class="value">${new Date(receipt.leasePeriod.start).toLocaleDateString()}</div>
            </div>
            <div>
              <div class="label">End</div>
              <div class="value">${new Date(receipt.leasePeriod.end).toLocaleDateString()}</div>
            </div>
          </div>
        </section>
        <section class="section">
          <div class="label">Payment Details</div>
          <div class="grid">
            <div>
              <div class="label">Amount</div>
              <div class="value">$${receipt.payment.amount}</div>
            </div>
            <div>
              <div class="label">Method</div>
              <div class="value">${receipt.payment.method}</div>
            </div>
            <div>
              <div class="label">Received</div>
              <div class="value">${new Date(receipt.payment.receivedAt).toLocaleDateString()}</div>
            </div>
          </div>
        </section>
      </body>
      </html>
    `;
  }
}

