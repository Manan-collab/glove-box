import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { SafeUser } from '../auth/utils/to-safe-user';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesService } from './expenses.service';

@ApiTags('expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post('cars/:carId/expenses')
  create(
    @CurrentUser() user: SafeUser,
    @Param('carId') carId: string,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expensesService.create(user.id, carId, dto);
  }

  @Get('cars/:carId/expenses')
  findAllForCar(
    @CurrentUser() user: SafeUser,
    @Param('carId') carId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.expensesService.findAllForCar(user.id, carId, query);
  }

  @Patch('expenses/:id')
  update(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(user.id, id, dto);
  }

  @Delete('expenses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.expensesService.remove(user.id, id);
  }
}
