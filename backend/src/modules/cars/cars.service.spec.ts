import { NotFoundException } from '@nestjs/common';
import { CarsService } from './cars.service';

describe('CarsService', () => {
  let service: CarsService;
  let prisma: {
    car: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const CAR = {
    id: 'car-1',
    userId: 'user-1',
    make: 'Honda',
    model: 'Civic',
    year: 2020,
    variant: 'VTi-L',
    vin: null,
    engine: '1.8L i-VTEC',
    fuelType: 'Petrol',
    transmission: 'CVT',
    bodyType: 'Sedan',
    powerBhp: 139,
    vehicleApiRef: null,
    odometerKm: 42000,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = {
      car: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new CarsService(prisma as any);
  });

  it('creates a car scoped to the given user', async () => {
    prisma.car.create.mockResolvedValue(CAR);
    const dto = { make: 'Honda', model: 'Civic' } as any;

    await service.create('user-1', dto);

    expect(prisma.car.create).toHaveBeenCalledWith({
      data: { ...dto, userId: 'user-1' },
    });
  });

  it("lists only the requesting user's cars, paginated", async () => {
    prisma.car.findMany.mockResolvedValue([CAR]);
    prisma.car.count.mockResolvedValue(1);

    const result = await service.findAllForUser('user-1', {
      page: 1,
      pageSize: 20,
    });

    expect(prisma.car.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    );
    expect(result.data).toEqual([CAR]);
    expect(result.meta.total).toBe(1);
  });

  it('returns a car only when it belongs to the requesting user', async () => {
    prisma.car.findFirst.mockResolvedValue(CAR);

    const result = await service.findOneForUser('user-1', 'car-1');

    expect(prisma.car.findFirst).toHaveBeenCalledWith({
      where: { id: 'car-1', userId: 'user-1' },
    });
    expect(result).toEqual(CAR);
  });

  it("throws NotFound instead of leaking existence of another user's car", async () => {
    prisma.car.findFirst.mockResolvedValue(null);

    await expect(service.findOneForUser('user-2', 'car-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('refuses to update a car owned by a different user', async () => {
    prisma.car.findFirst.mockResolvedValue(null);

    await expect(
      service.update('user-2', 'car-1', { make: 'Toyota' } as any),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.car.update).not.toHaveBeenCalled();
  });

  it('refuses to delete a car owned by a different user', async () => {
    prisma.car.findFirst.mockResolvedValue(null);

    await expect(service.remove('user-2', 'car-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.car.delete).not.toHaveBeenCalled();
  });
});
