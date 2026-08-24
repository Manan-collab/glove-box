import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CarsService } from '../cars/cars.service';
import { CreateNoteDto } from './dto/create-note.dto';

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carsService: CarsService,
  ) {}

  async create(userId: string, carId: string, dto: CreateNoteDto) {
    await this.carsService.findOneForUser(userId, carId);
    return this.prisma.carNote.create({ data: { ...dto, carId } });
  }

  async findAllForCar(userId: string, carId: string) {
    await this.carsService.findOneForUser(userId, carId);
    return this.prisma.carNote.findMany({
      where: { carId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(userId: string, noteId: string) {
    const note = await this.prisma.carNote.findFirst({
      where: { id: noteId, car: { userId } },
    });
    if (!note) {
      throw new NotFoundException('Note not found');
    }
    await this.prisma.carNote.delete({ where: { id: noteId } });
  }
}
