import { Module } from '@nestjs/common';
import { CarsModule } from '../cars/cars.module';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';

@Module({
  imports: [CarsModule],
  controllers: [NotesController],
  providers: [NotesService],
})
export class NotesModule {}
