import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Post()
  create(@CurrentUser('landlordId') landlordId: string, @Body() dto: CreatePropertyDto) {
    return this.propertiesService.create(landlordId, dto);
  }

  @Get()
  findAll(@CurrentUser('landlordId') landlordId: string) {
    return this.propertiesService.findAll(landlordId);
  }

  @Get(':id')
  findOne(@CurrentUser('landlordId') landlordId: string, @Param('id') id: string) {
    return this.propertiesService.findOne(landlordId, id);
  }

  @Patch(':id')
  update(@CurrentUser('landlordId') landlordId: string, @Param('id') id: string, @Body() dto: UpdatePropertyDto) {
    return this.propertiesService.update(landlordId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('landlordId') landlordId: string, @Param('id') id: string) {
    return this.propertiesService.remove(landlordId, id);
  }
}

