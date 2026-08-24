import { NotFoundException } from '@nestjs/common';
import { NotesService } from './notes.service';

describe('NotesService', () => {
  let service: NotesService;
  let prisma: {
    carNote: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      delete: jest.Mock;
    };
  };
  let carsService: { findOneForUser: jest.Mock };

  const NOTE = {
    id: 'note-1',
    carId: 'car-1',
    body: 'Replaced the timing belt',
    createdAt: new Date('2026-08-01'),
  };

  beforeEach(() => {
    prisma = {
      carNote: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
    };
    carsService = { findOneForUser: jest.fn() };
    service = new NotesService(prisma as any, carsService as any);
  });

  it('verifies car ownership before creating a note', async () => {
    carsService.findOneForUser.mockResolvedValue({ id: 'car-1' });
    prisma.carNote.create.mockResolvedValue(NOTE);

    await service.create('user-1', 'car-1', { body: NOTE.body });

    expect(carsService.findOneForUser).toHaveBeenCalledWith('user-1', 'car-1');
    expect(prisma.carNote.create).toHaveBeenCalledWith({
      data: { body: NOTE.body, carId: 'car-1' },
    });
  });

  it('refuses to create a note on a car the user does not own', async () => {
    carsService.findOneForUser.mockRejectedValue(new NotFoundException());

    await expect(
      service.create('user-2', 'car-1', { body: 'hi' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.carNote.create).not.toHaveBeenCalled();
  });

  it('lists notes for a car, most recent first, only after verifying ownership', async () => {
    carsService.findOneForUser.mockResolvedValue({ id: 'car-1' });
    prisma.carNote.findMany.mockResolvedValue([NOTE]);

    const result = await service.findAllForCar('user-1', 'car-1');

    expect(carsService.findOneForUser).toHaveBeenCalledWith('user-1', 'car-1');
    expect(prisma.carNote.findMany).toHaveBeenCalledWith({
      where: { carId: 'car-1' },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toEqual([NOTE]);
  });

  it('deletes a note scoped through the owning car', async () => {
    prisma.carNote.findFirst.mockResolvedValue(NOTE);

    await service.remove('user-1', 'note-1');

    expect(prisma.carNote.findFirst).toHaveBeenCalledWith({
      where: { id: 'note-1', car: { userId: 'user-1' } },
    });
    expect(prisma.carNote.delete).toHaveBeenCalledWith({
      where: { id: 'note-1' },
    });
  });

  it('refuses to delete a note not owned by the user', async () => {
    prisma.carNote.findFirst.mockResolvedValue(null);

    await expect(service.remove('user-2', 'note-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.carNote.delete).not.toHaveBeenCalled();
  });
});
