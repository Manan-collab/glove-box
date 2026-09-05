import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: { user: { findUnique: jest.Mock }; car: { findMany: jest.Mock } };
  let friendsService: { areFriends: jest.Mock };

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn() }, car: { findMany: jest.fn() } };
    friendsService = { areFriends: jest.fn() };
    service = new UsersService(prisma as any, friendsService as any);
  });

  it('throws NotFound when the username does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.getPublicGarage('user-1', 'ghost')).rejects.toThrow(
      NotFoundException,
    );
    expect(friendsService.areFriends).not.toHaveBeenCalled();
  });

  it('throws NotFound (not Forbidden) when the target exists but is not a friend', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-2',
      username: 'stranger',
    });
    friendsService.areFriends.mockResolvedValue(false);

    await expect(service.getPublicGarage('user-1', 'stranger')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.car.findMany).not.toHaveBeenCalled();
  });

  it('returns the public profile and car list for an actual friend', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-2',
      username: 'friend',
      displayName: 'Friend Name',
      avatarUrl: null,
    });
    friendsService.areFriends.mockResolvedValue(true);
    prisma.car.findMany.mockResolvedValue([{ id: 'car-1', make: 'Honda' }]);

    const result = await service.getPublicGarage('user-1', 'friend');

    expect(result.user).toEqual({
      id: 'user-2',
      username: 'friend',
      displayName: 'Friend Name',
      avatarUrl: null,
    });
    expect(result.cars).toEqual([{ id: 'car-1', make: 'Honda' }]);
    expect(prisma.car.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-2' } }),
    );
  });
});
