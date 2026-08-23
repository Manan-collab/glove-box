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
import { CarsService } from './cars.service';
import { CreateCarDto } from './dto/create-car.dto';
import { UpdateCarDto } from './dto/update-car.dto';

@ApiTags('cars')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cars')
export class CarsController {
  constructor(private readonly carsService: CarsService) {}

  @Post()
  create(@CurrentUser() user: SafeUser, @Body() dto: CreateCarDto) {
    return this.carsService.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: SafeUser, @Query() query: PaginationQueryDto) {
    return this.carsService.findAllForUser(user.id, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.carsService.findOneForUser(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Body() dto: UpdateCarDto,
  ) {
    return this.carsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.carsService.remove(user.id, id);
  }
}
