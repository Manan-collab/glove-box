import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FriendsService } from '../friends/friends.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly friendsService: FriendsService,
  ) {}

  async getPublicGarage(requesterId: string, username: string) {
    const targetUser = await this.prisma.user.findUnique({
      where: { username },
    });
    // Same message either way — a non-friend shouldn't be able to tell
    // "user doesn't exist" apart from "user exists but isn't your friend".
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }
    const isFriend = await this.friendsService.areFriends(
      requesterId,
      targetUser.id,
    );
    if (!isFriend) {
      throw new NotFoundException('User not found');
    }

    const cars = await this.prisma.car.findMany({
      where: { userId: targetUser.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        make: true,
        model: true,
        year: true,
        variant: true,
        engine: true,
        fuelType: true,
        transmission: true,
        bodyType: true,
        powerBhp: true,
        createdAt: true,
        // Deliberately excluded: vin, odometerKm, vehicleApiRef — private
        // per Section 9's public-garage authorization rule.
      },
    });

    return {
      user: {
        id: targetUser.id,
        username: targetUser.username,
        displayName: targetUser.displayName,
        avatarUrl: targetUser.avatarUrl,
      },
      cars,
    };
  }
}
