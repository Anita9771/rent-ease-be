import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { LeasesService } from './leases.service';
import { BadRequestException } from '@nestjs/common';
import { CreateLeaseDto, LeaseStatus, RentFrequency } from './dto/create-lease.dto';

describe('LeasesService', () => {
  let service: LeasesService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        LeasesService,
        {
          provide: PrismaService,
          useValue: {
            tenant: { findFirst: jest.fn() },
            unit: { findFirst: jest.fn(), update: jest.fn() },
            lease: { findFirst: jest.fn() },
            leaseDocument: { create: jest.fn() },
            rentInvoice: { findMany: jest.fn() },
            auditLog: { create: jest.fn() },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(LeasesService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('creates a lease when tenant and unit belong to landlord', async () => {
    prisma.tenant.findFirst.mockResolvedValue({ id: 'tenant-1' } as any);
    prisma.unit.findFirst.mockResolvedValue({ id: 'unit-1' } as any);
    const createdLease = {
      id: 'lease-1',
      unitId: 'unit-1',
      status: LeaseStatus.ACTIVE,
      tenant: { user: { email: 'tenant@rent.com' } },
      unit: { property: { name: 'Azure', address: '123 Street' } },
    };
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        lease: { create: jest.fn().mockResolvedValue(createdLease) },
        unit: { update: jest.fn() },
        auditLog: { create: jest.fn() },
      }),
    );

    const dto: CreateLeaseDto = {
      tenantId: 'tenant-1',
      unitId: 'unit-1',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
      rentAmount: 2150,
      rentFrequency: RentFrequency.MONTHLY,
      status: LeaseStatus.ACTIVE,
    };

    const result = await service.create('landlord-1', 'user-1', dto);
    expect(result).toEqual(createdLease);
    expect(prisma.tenant.findFirst).toHaveBeenCalledWith({ where: { id: 'tenant-1', landlordId: 'landlord-1' } });
    expect(prisma.unit.findFirst).toHaveBeenCalledWith({ where: { id: 'unit-1', property: { landlordId: 'landlord-1' } } });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('throws when tenant does not belong to landlord', async () => {
    prisma.tenant.findFirst.mockResolvedValue(null);
    const dto: CreateLeaseDto = {
      tenantId: 'tenant-2',
      unitId: 'unit-1',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
      rentAmount: 2150,
      rentFrequency: RentFrequency.MONTHLY,
    };

    await expect(service.create('landlord-1', 'user-1', dto)).rejects.toBeInstanceOf(BadRequestException);
  });
});

