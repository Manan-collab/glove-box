import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

const CURRENT_YEAR = new Date().getFullYear();

export class CreateCarDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  make: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  model: string;

  @ApiProperty()
  @IsInt()
  @Min(1900)
  @Max(CURRENT_YEAR + 1)
  year: number;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  variant: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vin?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  engine: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  fuelType: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  transmission: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  bodyType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  powerBhp?: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  odometerKm: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  usageTag?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  insuranceExpiryDate?: string;
}
