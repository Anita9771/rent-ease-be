import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReceiptsService } from './receipts.service';

@UseGuards(JwtAuthGuard)
@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Get()
  list(@CurrentUser() user: any) {
    if (user.role === 'TENANT') {
      return this.receiptsService.listForTenant(user.tenantId);
    }
    return [];
  }

  @Post(':paymentId/generate')
  generate(
    @Param('paymentId') paymentId: string,
    @CurrentUser('sub') actorUserId: string,
  ) {
    return this.receiptsService.generateReceipt(paymentId, actorUserId);
  }

  @Get(':paymentId')
  getTenantReceipt(
    @Param('paymentId') paymentId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.receiptsService.getReceipt(paymentId, tenantId);
  }
}

