import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  create(landlordId: string, dto: CreatePropertyDto) {
    return this.prisma.property.create({
      data: {
        landlordId,
        name: dto.name,
        address: dto.address,
        type: dto.type,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  findAll(landlordId: string) {
    return this.prisma.property.findMany({
      where: { landlordId },
      include: { units: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(landlordId: string, id: string) {
    const property = await this.prisma.property.findFirst({
      where: { id, landlordId },
      include: { units: true, expenses: true },
    });
    if (!property) {
      throw new NotFoundException('Property not found');
    }
    return property;
  }

  async update(landlordId: string, id: string, dto: UpdatePropertyDto) {
    await this.findOne(landlordId, id);
    return this.prisma.property.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.address && { address: dto.address }),
        ...(dto.type && { type: dto.type }),
        ...(dto.metadata && { metadata: dto.metadata as Prisma.InputJsonValue }),
      },
    });
  }

  async remove(landlordId: string, id: string) {
    await this.findOne(landlordId, id);
    return this.prisma.property.update({
      where: { id },
      data: { metadata: { deletedAt: new Date() } },
    });
  }
}

