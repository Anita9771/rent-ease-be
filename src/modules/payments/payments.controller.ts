import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@CurrentUser() user: any) {
    if (user.role === 'LANDLORD' || user.role === 'PROPERTY_MANAGER') {
      return this.paymentsService.listForLandlord(user.landlordId);
    }
    if (user.role === 'TENANT') {
      return this.paymentsService.listForTenant(user.tenantId);
    }
    return [];
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  initiate(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: InitiatePaymentDto,
  ) {
    return this.paymentsService.initiatePayment(tenantId, userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/confirm')
  confirm(
    @CurrentUser('landlordId') landlordId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id') paymentId: string,
    @Body() dto: ConfirmPaymentDto,
  ) {
    return this.paymentsService.confirmPayment(landlordId, actorUserId, paymentId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('methods')
  getPaymentMethods(@CurrentUser('tenantId') tenantId: string) {
    return this.paymentsService.getPaymentMethods(tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('methods')
  addPaymentMethod(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: { type: string; last4?: string; brand?: string },
  ) {
    return this.paymentsService.addPaymentMethod(tenantId, userId, dto);
  }

  @Post('webhook/stripe')
  async handleStripeWebhook(@Body() payload: any) {
    await this.paymentsService.handleStripeWebhook(payload);
    return { received: true };
  }
}

