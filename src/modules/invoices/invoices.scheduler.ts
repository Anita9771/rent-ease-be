import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicesService } from './invoices.service';

@Injectable()
export class InvoicesScheduler {
  private readonly logger = new Logger(InvoicesScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async handleDailyReminders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueSoon = await this.prisma.rentInvoice.findMany({
      where: {
        status: InvoiceStatus.PENDING,
        dueDate: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      select: { id: true },
    });

    for (const invoice of dueSoon) {
      try {
        await this.invoicesService.sendReminder(invoice.id);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.stack : String(error);
        this.logger.error(`Failed to send reminder for invoice ${invoice.id}`, errorMessage);
      }
    }

    const overdue = await this.prisma.rentInvoice.findMany({
      where: {
        status: InvoiceStatus.PENDING,
        dueDate: { lt: today },
      },
      select: { id: true },
    });

    for (const invoice of overdue) {
      try {
        await this.invoicesService.markOverdue(invoice.id);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.stack : String(error);
        this.logger.error(`Failed to mark overdue invoice ${invoice.id}`, errorMessage);
      }
    }
  }
}

