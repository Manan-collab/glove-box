import { ApiProperty } from '@nestjs/swagger';
import { RowErrorDto } from './row-error.dto';

export class ImportResultDto {
  @ApiProperty()
  carsCreated: number;

  @ApiProperty()
  expensesCreated: number;

  @ApiProperty()
  expensesUpdated: number;

  // Any error means nothing was imported (all-or-nothing) and every count is 0.
  @ApiProperty({ type: [RowErrorDto] })
  errors: RowErrorDto[];

  // Adjustments made during an import that otherwise went through.
  @ApiProperty({ type: [RowErrorDto] })
  warnings: RowErrorDto[];
}
