import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { SafeUser } from '../auth/utils/to-safe-user';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('garage')
  forGarage(@CurrentUser() user: SafeUser) {
    return this.analyticsService.forGarage(user.id);
  }

  @Get('cars/:id')
  forCar(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.analyticsService.forCar(user.id, id);
  }
}
