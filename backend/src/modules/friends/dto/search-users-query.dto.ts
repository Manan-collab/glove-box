import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class SearchUsersQueryDto {
  @ApiProperty({
    description: 'Substring to match against username or display name',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  q!: string;
}
