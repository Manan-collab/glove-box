import { ApiProperty } from '@nestjs/swagger';
import { RowErrorDto } from './row-error.dto';

export class ImportResultDto {
  @ApiProperty()
  carsCreated: number;

  @ApiProperty()
  carsUpdated: number;

  @ApiProperty()
  expensesCreated: number;

  @ApiProperty()
  expensesUpdated: number;

  @ApiProperty({ type: [RowErrorDto] })
  errors: RowErrorDto[];
}
