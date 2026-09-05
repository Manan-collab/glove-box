import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum AnalyticsPeriod {
  ALL = 'ALL',
  LAST_30_DAYS = 'LAST_30_DAYS',
  LAST_6_MONTHS = 'LAST_6_MONTHS',
  LAST_1_YEAR = 'LAST_1_YEAR',
}

export class AnalyticsQueryDto {
  @ApiPropertyOptional({ enum: AnalyticsPeriod, default: AnalyticsPeriod.ALL })
  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period?: AnalyticsPeriod = AnalyticsPeriod.ALL;
}
