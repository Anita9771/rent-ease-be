import { BadRequestException, Body, Controller, Get, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LeasesService } from './leases.service';
import { CreateLeaseDto } from './dto/create-lease.dto';
import { UpdateLeaseStatusDto } from './dto/update-lease-status.dto';

@UseGuards(JwtAuthGuard)
@Controller('leases')
export class LeasesController {
  constructor(private readonly leasesService: LeasesService) {}

  @Post()
  create(
    @CurrentUser('landlordId') landlordId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: CreateLeaseDto,
  ) {
    return this.leasesService.create(landlordId, actorUserId, dto);
  }

  @Get('documents')
  getTenantDocuments(@CurrentUser('tenantId') tenantId: string) {
    return this.leasesService.getTenantDocuments(tenantId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') leaseId: string) {
    if (user.role === 'LANDLORD' || user.role === 'PROPERTY_MANAGER') {
      return this.leasesService.findOne(user.landlordId, leaseId);
    }
    if (user.role === 'TENANT') {
      return this.leasesService.findOneByTenant(user.tenantId, leaseId);
    }
    throw new BadRequestException('Invalid user role');
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser('landlordId') landlordId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id') leaseId: string,
    @Body() dto: UpdateLeaseStatusDto,
  ) {
    return this.leasesService.updateStatus(landlordId, actorUserId, leaseId, dto);
  }

  @Post(':id/documents')
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @CurrentUser('landlordId') landlordId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id') leaseId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.leasesService.attachDocument(landlordId, actorUserId, leaseId, file.path, file.mimetype);
  }
}

