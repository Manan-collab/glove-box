import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { SafeUser } from '../auth/utils/to-safe-user';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('garage')
  forGarage(@CurrentUser() user: SafeUser, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.forGarage(user.id, query.period);
  }

  @Get('cars/:id')
  forCar(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.forCar(user.id, id, query.period);
  }
}
