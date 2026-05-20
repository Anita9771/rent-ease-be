import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        landlord: true,
        tenant: true,
        propertyStaff: true,
      },
    });
  }

  async createUser(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({ data });
  }

  async ensureLandlordProfile(userId: string, companyName: string, phone?: string) {
    return this.prisma.landlord.upsert({
      where: { userId },
      update: { companyName, phone },
      create: {
        userId,
        companyName,
        phone,
      },
    });
  }

  async ensureTenantProfile(
    userId: string,
    landlordId: string,
    phone?: string,
    emergencyContact?: Prisma.JsonValue,
    avatarUrl?: string,
  ) {
    return this.prisma.tenant.upsert({
      where: { userId },
      update: {
        landlordId,
        primaryContactPhone: phone,
        emergencyContact: emergencyContact as Prisma.InputJsonValue | undefined,
        ...(avatarUrl !== undefined && { avatarUrl }),
      },
      create: {
        userId,
        landlordId,
        primaryContactPhone: phone,
        emergencyContact: emergencyContact as Prisma.InputJsonValue | undefined,
        avatarUrl,
      },
    });
  }

  async listLandlordTenants(landlordId: string) {
    return this.prisma.tenant.findMany({
      where: { landlordId },
      include: {
        user: true,
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
              include: { property: true },
            },
          },
        },
      },
    });
  }

  async setPassword(userId: string, passwordHash: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async updateStatus(userId: string, status: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { status },
    });
  }

  async createInvite(params: {
    landlordId: string;
    email: string;
    role: UserRole;
    inviteToken: string;
    expiresAt: Date;
    propertyId?: string;
  }) {
    return this.prisma.invite.create({
      data: {
        landlordId: params.landlordId,
        email: params.email,
        role: params.role,
        inviteToken: params.inviteToken,
        expiresAt: params.expiresAt,
        propertyId: params.propertyId,
      },
    });
  }

  async consumeInvite(inviteToken: string) {
    const invite = await this.prisma.invite.findFirst({
      where: { inviteToken },
    });
    if (!invite) {
      throw new NotFoundException('Invite not found');
    }
    return this.prisma.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
  }

  async getCurrentUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        landlord: true,
        tenant: true,
        propertyStaff: true,
      },
    });
  }

  async updateProfile(
    userId: string,
    tenantId: string | undefined,
    landlordId: string | undefined,
    propertyManagerId: string | undefined,
    dto: { phone?: string; emergencyContact?: any; displayName?: string; title?: string; avatarUrl?: string },
  ) {
    if (tenantId) {
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          ...(dto.phone !== undefined && { primaryContactPhone: dto.phone }),
          ...(dto.emergencyContact !== undefined && { emergencyContact: dto.emergencyContact as Prisma.InputJsonValue }),
          ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
        },
      });
      return this.getCurrentUser(userId);
    }

    if (landlordId) {
      await this.prisma.landlord.update({
        where: { id: landlordId },
        data: {
          ...(dto.displayName !== undefined && { displayName: dto.displayName }),
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
        },
      });
      return this.getCurrentUser(userId);
    }

    if (propertyManagerId) {
      await this.prisma.propertyManager.update({
        where: { id: propertyManagerId },
        data: {
          ...(dto.displayName !== undefined && { displayName: dto.displayName }),
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
        },
      });
      return this.getCurrentUser(userId);
    }

    return this.getCurrentUser(userId);
  }

  private defaultNotificationPreferences() {
    return {
      emailLandlordSummary: true,
      smsEscalations: true,
      tenantFeedbackDigest: false,
    };
  }

  async getNotificationPreferences(landlordId: string | undefined) {
    if (!landlordId) {
      throw new BadRequestException('Only landlords have notification preferences');
    }
    const landlord = await this.prisma.landlord.findUnique({ where: { id: landlordId } });
    if (!landlord) {
      throw new NotFoundException('Landlord not found');
    }
    const stored = landlord.notificationPreferences as Record<string, boolean> | null;
    return { ...this.defaultNotificationPreferences(), ...(stored ?? {}) };
  }

  async updateNotificationPreferences(
    landlordId: string | undefined,
    dto: { emailLandlordSummary?: boolean; smsEscalations?: boolean; tenantFeedbackDigest?: boolean },
  ) {
    if (!landlordId) {
      throw new BadRequestException('Only landlords have notification preferences');
    }
    const current = await this.getNotificationPreferences(landlordId);
    const merged = { ...current, ...dto };
    await this.prisma.landlord.update({
      where: { id: landlordId },
      data: { notificationPreferences: merged },
    });
    return merged;
  }
}

