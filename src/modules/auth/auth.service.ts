import { Injectable, UnauthorizedException, ConflictException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { RegisterLandlordDto } from './dto/register-landlord.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID, randomBytes } from 'crypto';

type TokenBundle = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async registerLandlord(dto: RegisterLandlordDto) {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await argon2.hash(dto.password);
    const landlord = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          role: UserRole.LANDLORD,
        },
      });
      const landlordProfile = await tx.landlord.create({
        data: {
          userId: user.id,
          companyName: dto.companyName,
          phone: dto.phone,
          displayName: dto.displayName,
          title: dto.title,
          avatarUrl: dto.avatarUrl,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: 'LANDLORD_REGISTERED',
          entityType: 'LANDLORD',
          entityId: landlordProfile.id,
        },
      });
      return { user, landlordProfile };
    });

    await this.subscriptionsService.ensureTrialForLandlord(landlord.landlordProfile.id);

    await this.subscriptionsService.ensureTrialForLandlord(landlord.landlordProfile.id);

    const tokenBundle = await this.generateTokens({
      userId: landlord.user.id,
      role: landlord.user.role,
      landlordId: landlord.landlordProfile.id,
    });

    // Fire-and-forget welcome message (log on failure but don't block signup)
    this.emailService
      .sendLandlordWelcome(landlord.user.email, dto.companyName)
      .catch((error) => this.logger?.error?.('Failed to send landlord welcome email', error));

    return {
      user: {
        id: landlord.user.id,
        email: landlord.user.email,
        role: landlord.user.role,
        landlordId: landlord.landlordProfile.id,
      },
      tokens: tokenBundle,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const landlordId = user.landlord?.id ?? user.tenant?.landlordId ?? null;
    const tenantId = user.tenant?.id;
    const tokenBundle = await this.generateTokens({
      userId: user.id,
      role: user.role,
      landlordId: landlordId ?? undefined,
      tenantId: tenantId ?? undefined,
    });
    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        landlordId,
        tenantId: user.tenant?.id,
      },
      tokens: tokenBundle,
    };
  }

  async refresh(dto: RefreshTokenDto) {
    try {
      const payload = await this.jwt.verifyAsync(dto.refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { landlord: true, tenant: true },
      });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      const landlordId = user.landlord?.id ?? user.tenant?.landlordId ?? undefined;
      const tenantId = user.tenant?.id ?? undefined;
      const tokens = await this.generateTokens({
        userId: user.id,
        role: user.role,
        landlordId,
        tenantId,
      });
      return {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          landlordId,
          tenantId,
        },
        tokens,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async acceptInvite(dto: AcceptInviteDto) {
    const invite = await this.prisma.invite.findFirst({
      where: { inviteToken: dto.inviteToken },
    });
    if (!invite) {
      throw new NotFoundException('Invite not found');
    }
    if (invite.email.toLowerCase() !== dto.email.toLowerCase()) {
      throw new BadRequestException('Invite email mismatch');
    }
    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('Invite expired');
    }
    if (invite.acceptedAt) {
      throw new BadRequestException('Invite already accepted');
    }

    const existingUser = await this.usersService.findByEmail(dto.email);
    if (!existingUser) {
      throw new NotFoundException('User not found. Please contact your landlord to resend the invitation.');
    }

    // Update password if provided (user can change from temp password)
    let passwordHash = existingUser.passwordHash;
    if (dto.password) {
      passwordHash = await argon2.hash(dto.password);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: existingUser.id },
        data: {
          passwordHash,
        },
      });

      // Update tenant phone if provided
      if (invite.role === UserRole.TENANT && dto.phone) {
        await tx.tenant.updateMany({
          where: { userId: user.id },
          data: { primaryContactPhone: dto.phone },
        });
      }

      // Create property manager profile if it doesn't exist (for property managers accepting invite)
      if (invite.role === UserRole.PROPERTY_MANAGER) {
        const existingPM = await tx.propertyManager.findUnique({
          where: { userId: user.id },
        });
        if (!existingPM) {
          await tx.propertyManager.create({
          data: {
            userId: user.id,
            landlordId: invite.landlordId,
          },
        });
        }
      }

      await tx.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: 'INVITE_ACCEPTED',
          entityType: invite.role,
          entityId: user.id,
        },
      });

      return user;
    });

    const tenant = await this.prisma.tenant.findUnique({
      where: { userId: result.id },
      select: { id: true },
    });

    const propertyManager = await this.prisma.propertyManager.findUnique({
      where: { userId: result.id },
      select: { id: true },
    });

    const tokens = await this.generateTokens({
      userId: result.id,
      role: invite.role,
      landlordId: invite.landlordId,
      tenantId: tenant?.id,
      propertyManagerId: propertyManager?.id,
    });
    return { user: { id: result.id, email: result.email, role: result.role }, tokens };
  }

  async sendInvite(
    landlordId: string,
    email: string,
    role: UserRole,
    options?: {
      propertyId?: string;
    },
  ) {
    const inviteToken = randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days
    const propertyId = options?.propertyId;

    if (role === UserRole.TENANT) {
      if (!propertyId) {
        throw new BadRequestException('propertyId is required when inviting a tenant.');
      }
      const property = await this.prisma.property.findFirst({
        where: { id: propertyId, landlordId },
        select: { id: true },
      });
      if (!property) {
        throw new BadRequestException('Property not found for this landlord.');
      }
    }
    
    // Generate a secure temporary password
    const tempPassword = this.generateTemporaryPassword();
    const passwordHash = await argon2.hash(tempPassword);
    
    // Store the temporary password hash in the invite (we'll use a JSON field or create a separate table)
    // For now, we'll store it in a way that allows us to create the user when they accept
    // We'll create the user with the temp password when they accept the invite
    
    await this.usersService.createInvite({ landlordId, email, role, inviteToken, expiresAt, propertyId });

    // Get landlord name for email
    const landlord = await this.prisma.landlord.findUnique({
      where: { id: landlordId },
      select: { companyName: true },
    });

    // Store temp password temporarily - we'll need to modify the invite model or use a different approach
    // For now, let's create the user immediately with the temp password and mark them as needing password change
    // Actually, let's create the user when sending invite so they can login immediately
    const existingUser = await this.usersService.findByEmail(email);
    let userId: string;
    
    if (existingUser) {
      userId = existingUser.id;
      if (role === UserRole.TENANT) {
        await this.prisma.tenant.upsert({
          where: { userId },
          update: {
            landlordId,
            propertyId,
          },
          create: {
            userId,
            landlordId,
            propertyId,
          },
        });
      }
    } else {
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          role,
        },
      });
      userId = user.id;

      // Create tenant profile if role is TENANT
      if (role === UserRole.TENANT) {
        await this.prisma.tenant.upsert({
          where: { userId: user.id },
          update: {
            landlordId,
            propertyId,
          },
          create: {
            userId: user.id,
            landlordId,
            propertyId,
          },
        });
      }

      // Create property manager profile if role is PROPERTY_MANAGER
      if (role === UserRole.PROPERTY_MANAGER) {
        await this.prisma.propertyManager.create({
          data: {
            userId: user.id,
            landlordId,
          },
        });
      }
    }

    // Send email with password based on role
    if (role === UserRole.TENANT) {
      await this.emailService.sendTenantInvite(
        email,
        tempPassword,
        inviteToken,
        landlord?.companyName ?? 'Your landlord',
      );
    } else if (role === UserRole.PROPERTY_MANAGER) {
      await this.emailService.sendPropertyManagerInvite(
        email,
        tempPassword,
        inviteToken,
        landlord?.companyName ?? 'Your landlord',
      );
    }

    return { inviteToken, expiresAt, userId };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('User not found or has no password set');
    }

    const isValid = await argon2.verify(user.passwordHash, currentPassword);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newPasswordHash = await argon2.hash(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    return { success: true };
  }

  async logout(userId: string) {
    await this.prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: 'USER_LOGOUT',
        entityType: 'USER',
        entityId: userId,
      },
    });
    return { success: true };
  }

  private generateTemporaryPassword(): string {
    // Generate a secure 12-character password
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const password = Array.from(randomBytes(12))
      .map((byte) => chars[byte % chars.length])
      .join('');
    return password;
  }

  private async generateTokens(params: {
    userId: string;
    role: UserRole;
    landlordId?: string;
    tenantId?: string;
    propertyManagerId?: string;
  }): Promise<TokenBundle> {
    const accessPayload = {
      sub: params.userId,
      role: params.role,
      landlordId: params.landlordId,
      tenantId: params.tenantId,
      propertyManagerId: params.propertyManagerId,
    };
    const refreshPayload = { sub: params.userId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload),
      this.jwt.signAsync(refreshPayload, {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: this.config.get<string>('jwt.refreshExpiresIn') ?? '7d',
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.get<string>('jwt.accessExpiresIn') ?? '15m',
    };
  }
}

