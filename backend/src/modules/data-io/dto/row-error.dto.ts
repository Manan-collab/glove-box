import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RowErrorDto {
  @ApiProperty({ description: 'The sheet name this error occurred on' })
  sheet: string;

  @ApiPropertyOptional({
    description:
      'The 1-indexed spreadsheet row, when the error is about a specific expense row rather than the whole car sheet',
  })
  row?: number;

  @ApiPropertyOptional({
    description:
      'A1-style cell reference (e.g. "C23"), when the issue is about one cell',
  })
  cell?: string;

  @ApiProperty()
  message: string;
}
