import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RowErrorDto {
  @ApiProperty({ description: 'The sheet name this error occurred on' })
  sheet: string;

  @ApiPropertyOptional({
    description:
      'The 1-indexed spreadsheet row, when the error is about a specific expense row rather than the whole car sheet',
  })
  row?: number;

  @ApiProperty()
  message: string;
}
