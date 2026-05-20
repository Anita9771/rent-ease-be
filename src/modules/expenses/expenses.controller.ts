import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  create(
    @CurrentUser('landlordId') landlordId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expensesService.create(landlordId, actorUserId, dto);
  }

  @Get()
  findAll(@CurrentUser('landlordId') landlordId: string) {
    return this.expensesService.findAll(landlordId);
  }

  @Get('summary')
  summary(
    @CurrentUser('landlordId') landlordId: string,
    @Query('year') year: string,
  ) {
    return this.expensesService.getSummary(landlordId, parseInt(year ?? `${new Date().getFullYear()}`, 10));
  }

  @Get('export-rent-roll')
  exportRentRoll(@CurrentUser('landlordId') landlordId: string) {
    return this.expensesService.exportRentRoll(landlordId);
  }

  @Get(':id')
  findOne(@CurrentUser('landlordId') landlordId: string, @Param('id') id: string) {
    return this.expensesService.findOne(landlordId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('landlordId') landlordId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(landlordId, actorUserId, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser('landlordId') landlordId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id') id: string,
  ) {
    return this.expensesService.remove(landlordId, actorUserId, id);
  }
}

