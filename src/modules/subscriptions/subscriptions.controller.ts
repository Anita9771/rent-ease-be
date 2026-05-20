import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@UseGuards(JwtAuthGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('plans')
  listPlans() {
    return this.subscriptionsService.listPlans();
  }

  @Get('current')
  getCurrent(@CurrentUser('landlordId') landlordId: string) {
    return this.subscriptionsService.getCurrentSubscription(landlordId);
  }

  @Post()
  upsert(
    @CurrentUser('landlordId') landlordId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.subscriptionsService.upsertSubscription(landlordId, actorUserId, dto);
  }
}

