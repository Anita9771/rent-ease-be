import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicesService } from './invoices.service';
import { InvoiceStatus } from '@prisma/client';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        InvoicesService,
        {
          provide: PrismaService,
          useValue: {
            lease: { findFirst: jest.fn(), findUnique: jest.fn() },
            rentInvoice: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
            notification: { create: jest.fn() },
            auditLog: { create: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get(InvoicesService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  afterEach(() => jest.resetAllMocks());

  it('marks invoice as overdue', async () => {
    prisma.rentInvoice.update.mockResolvedValue({ id: 'invoice-1', status: InvoiceStatus.OVERDUE } as any);
    await service.markOverdue('invoice-1');
    expect(prisma.rentInvoice.update).toHaveBeenCalledWith({
      where: { id: 'invoice-1' },
      data: { status: InvoiceStatus.OVERDUE },
    });
  });

  it('sends reminder and logs notification', async () => {
    prisma.rentInvoice.findUnique.mockResolvedValue({
      id: 'invoice-1',
      amountDue: 2150,
      dueDate: new Date(),
      tenant: { user: { id: 'user-tenant' } },
    } as any);
    prisma.notification.create.mockResolvedValue({ id: 'notification-1' } as any);

    await service.sendReminder('invoice-1', 'actor-1', 'email');

    expect(prisma.notification.create).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: 'actor-1',
          action: 'INVOICE_REMINDER_SENT',
        }),
      }),
    );
  });
});

