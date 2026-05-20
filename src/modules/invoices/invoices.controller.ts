import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { ListInvoicesDto } from './dto/list-invoices.dto';
import { SendInvoiceReminderDto } from './dto/send-invoice-reminder.dto';

@UseGuards(JwtAuthGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  async list(@CurrentUser() user: any, @Query() query: ListInvoicesDto) {
    if (user.role === 'LANDLORD') {
      const invoices = await this.invoicesService.listForLandlord(user.landlordId, query);
      return invoices.map((invoice) => ({
        id: invoice.id,
        tenant: invoice.tenant.user.email.split('@')[0],
        tenantId: invoice.tenant.id,
        unit: invoice.lease.unit.property
          ? `${invoice.lease.unit.property.name} • ${invoice.lease.unit.unitNumber}`
          : invoice.lease.unit.unitNumber,
        dueDate: invoice.dueDate.toISOString(),
        status: invoice.status,
        amount: Number(invoice.amountDue),
      }));
    }

    if (user.role === 'PROPERTY_MANAGER') {
      const invoices = await this.invoicesService.listForPropertyManager(user.propertyManagerId, query);
      return invoices.map((invoice) => ({
        id: invoice.id,
        tenant: invoice.tenant.user.email.split('@')[0],
        tenantUserId: invoice.tenant.userId,
        unit: invoice.lease.unit.property
          ? `${invoice.lease.unit.property.name} • ${invoice.lease.unit.unitNumber}`
          : invoice.lease.unit.unitNumber,
        dueDate: invoice.dueDate.toISOString(),
        status: invoice.status,
        amount: Number(invoice.amountDue),
      }));
    }

    if (user.role === 'TENANT') {
      const invoices = await this.invoicesService.listForTenant(user.tenantId, query);
      return invoices.map((invoice) => ({
        id: invoice.id,
        unit: invoice.lease.unit.property
          ? `${invoice.lease.unit.property.name} • ${invoice.lease.unit.unitNumber}`
          : invoice.lease.unit.unitNumber,
        dueDate: invoice.dueDate.toISOString(),
        status: invoice.status,
        amount: Number(invoice.amountDue),
      }));
    }

    return [];
  }

  @Get(':id')
  async getInvoice(@CurrentUser() user: any, @Param('id') invoiceId: string) {
    if (user.role === 'LANDLORD') {
      return this.invoicesService.getInvoice(user.landlordId, invoiceId);
    }
    if (user.role === 'PROPERTY_MANAGER') {
      return this.invoicesService.getInvoiceForPropertyManager(user.propertyManagerId, invoiceId);
    }
    if (user.role === 'TENANT') {
      return this.invoicesService.getInvoiceForTenant(user.tenantId, invoiceId);
    }
    throw new BadRequestException('Invalid user role');
  }

  @Post()
  createManual(
    @CurrentUser('landlordId') landlordId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.invoicesService.createManual(landlordId, actorUserId, dto);
  }

  @Post('generate')
  async generateInvoices(
    @CurrentUser('landlordId') landlordId: string,
    @CurrentUser('sub') actorUserId: string,
  ) {
    return this.invoicesService.generateInvoicesForActiveLeases(landlordId, actorUserId);
  }

  @Post(':id/remind')
  sendReminder(
    @CurrentUser('sub') actorUserId: string,
    @Param('id') invoiceId: string,
    @Body() dto: SendInvoiceReminderDto,
  ) {
    return this.invoicesService.sendReminder(invoiceId, actorUserId, dto.channel);
  }
}

