import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { SafeUser } from '../auth/utils/to-safe-user';
import { CreateNoteDto } from './dto/create-note.dto';
import { NotesService } from './notes.service';

@ApiTags('notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post('cars/:carId/notes')
  create(
    @CurrentUser() user: SafeUser,
    @Param('carId') carId: string,
    @Body() dto: CreateNoteDto,
  ) {
    return this.notesService.create(user.id, carId, dto);
  }

  @Get('cars/:carId/notes')
  findAllForCar(@CurrentUser() user: SafeUser, @Param('carId') carId: string) {
    return this.notesService.findAllForCar(user.id, carId);
  }

  @Delete('notes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.notesService.remove(user.id, id);
  }
}
