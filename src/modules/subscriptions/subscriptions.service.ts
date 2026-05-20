import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPlans() {
    await this.ensureDefaultPlans();
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { priceMonthly: 'asc' },
    });
  }

  async ensureDefaultPlans() {
    const count = await this.prisma.subscriptionPlan.count();
    if (count > 0) return;

    const defaults = [
      {
        name: 'Starter',
        priceMonthly: 49,
        priceYearly: 470,
        unitLimit: 20,
        features: ['Automated invoices', 'Tenant portal', 'Email reminders', 'Basic analytics'],
      },
      {
        name: 'Growth',
        priceMonthly: 129,
        priceYearly: 1238,
        unitLimit: 100,
        features: ['Everything in Starter', 'Custom branding', 'SMS + WhatsApp reminders', 'Advanced reports'],
      },
      {
        name: 'Enterprise',
        priceMonthly: 0,
        priceYearly: 0,
        unitLimit: 9999,
        features: ['Dedicated CSM', 'SLA-backed support', 'BI integrations', 'SAML SSO'],
      },
    ];

    for (const plan of defaults) {
      await this.prisma.subscriptionPlan.create({ data: plan });
    }
  }

  async ensureTrialForLandlord(landlordId: string) {
    const existing = await this.prisma.subscription.findFirst({ where: { landlordId } });
    if (existing) return existing;

    await this.ensureDefaultPlans();
    const growthPlan = await this.prisma.subscriptionPlan.findFirst({
      where: { name: 'Growth' },
      orderBy: { createdAt: 'asc' },
    });
    if (!growthPlan) return null;

    return this.prisma.subscription.create({
      data: {
        landlordId,
        planId: growthPlan.id,
        status: SubscriptionStatus.TRIALING,
        currentPeriodEnd: this.computeTrialEnd(),
      },
      include: { plan: true },
    });
  }

  async getCurrentSubscription(landlordId: string) {
    const existing = await this.prisma.subscription.findFirst({
      where: { landlordId },
      include: { plan: true },
    });
    if (existing) return existing;
    return this.ensureTrialForLandlord(landlordId);
  }

  async upsertSubscription(landlordId: string, actorUserId: string, dto: CreateSubscriptionDto) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: dto.planId } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    const existing = await this.prisma.subscription.findFirst({
      where: { landlordId },
    });

    const subscription = existing
      ? await this.prisma.subscription.update({
          where: { id: existing.id },
          data: {
            planId: dto.planId,
            status: dto.status ?? SubscriptionStatus.ACTIVE,
            stripeSubscriptionId: dto.stripeSubscriptionId,
          },
        })
      : await this.prisma.subscription.create({
          data: {
            landlordId,
            planId: dto.planId,
            status: dto.status ?? SubscriptionStatus.TRIALING,
            stripeSubscriptionId: dto.stripeSubscriptionId,
            currentPeriodEnd: this.computeTrialEnd(),
          },
        });

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: 'SUBSCRIPTION_UPDATED',
        entityType: 'SUBSCRIPTION',
        entityId: subscription.id,
        metadata: {
          planId: plan.id,
          status: subscription.status,
        },
      },
    });

    return subscription;
  }

  async handleStripeWebhook(event: any) {
    const { type, data } = event;
    switch (type) {
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const subscription = data.object;
        await this.prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: this.mapStripeStatus(subscription.status),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
        });
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = data.object;
        await this.prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: { status: SubscriptionStatus.CANCELED },
        });
        break;
      }
      default:
        break;
    }
  }

  private computeTrialEnd() {
    const trialDays = 14;
    const now = new Date();
    now.setDate(now.getDate() + trialDays);
    return now;
  }

  private mapStripeStatus(status: string): SubscriptionStatus {
    const mapping: Record<string, SubscriptionStatus> = {
      trialing: SubscriptionStatus.TRIALING,
      active: SubscriptionStatus.ACTIVE,
      past_due: SubscriptionStatus.PAST_DUE,
      canceled: SubscriptionStatus.CANCELED,
      incomplete: SubscriptionStatus.INCOMPLETE,
      incomplete_expired: SubscriptionStatus.INCOMPLETE,
      unpaid: SubscriptionStatus.PAST_DUE,
    };
    return mapping[status] ?? SubscriptionStatus.ACTIVE;
  }
}

