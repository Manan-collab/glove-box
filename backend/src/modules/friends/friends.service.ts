import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';

const PUBLIC_PROFILE_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService) {}

  async sendRequest(fromUserId: string, toUsername: string) {
    const toUser = await this.prisma.user.findUnique({
      where: { username: toUsername },
    });
    if (!toUser) {
      throw new NotFoundException('User not found');
    }
    if (toUser.id === fromUserId) {
      throw new ConflictException(
        'You cannot send a friend request to yourself',
      );
    }

    if (await this.areFriends(fromUserId, toUser.id)) {
      throw new ConflictException('Already friends');
    }

    const reverseRequest = await this.prisma.friendRequest.findUnique({
      where: {
        fromUserId_toUserId: { fromUserId: toUser.id, toUserId: fromUserId },
      },
    });
    if (reverseRequest) {
      throw new ConflictException(
        'This user already sent you a friend request — accept it instead',
      );
    }

    return this.prisma.friendRequest.create({
      data: { fromUserId, toUserId: toUser.id },
    });
  }

  async listRequests(userId: string) {
    const incoming = await this.prisma.friendRequest.findMany({
      where: { toUserId: userId },
      include: { fromUser: { select: PUBLIC_PROFILE_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
    const outgoing = await this.prisma.friendRequest.findMany({
      where: { fromUserId: userId },
      include: { toUser: { select: PUBLIC_PROFILE_SELECT } },
      orderBy: { createdAt: 'desc' },
    });

    return {
      incoming: incoming.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        user: r.fromUser,
      })),
      outgoing: outgoing.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        user: r.toUser,
      })),
    };
  }

  async acceptRequest(userId: string, requestId: string) {
    const req = await this.prisma.friendRequest.findFirst({
      where: { id: requestId, toUserId: userId },
    });
    if (!req) {
      throw new NotFoundException('Friend request not found');
    }

    const [userAId, userBId] = this.canonicalPair(req.fromUserId, req.toUserId);
    // No $transaction here — see Section 0's Prisma driver-adapter gotcha,
    // which extends to $transaction in *any* form with this adapter/Neon
    // combo, not just concurrent batches. Create the friendship first so a
    // failure between these two steps leaves a retryable "still pending"
    // state rather than a lost connection.
    try {
      await this.prisma.friendship.create({ data: { userAId, userBId } });
    } catch (error) {
      const isDuplicate =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002';
      if (!isDuplicate) {
        throw error;
      }
    }
    await this.prisma.friendRequest.delete({ where: { id: requestId } });
  }

  async rejectRequest(userId: string, requestId: string) {
    const req = await this.prisma.friendRequest.findFirst({
      where: { id: requestId, toUserId: userId },
    });
    if (!req) {
      throw new NotFoundException('Friend request not found');
    }
    await this.prisma.friendRequest.delete({ where: { id: requestId } });
  }

  async listFriends(userId: string) {
    const rows = await this.prisma.friendship.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      include: {
        userA: { select: PUBLIC_PROFILE_SELECT },
        userB: { select: PUBLIC_PROFILE_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => (row.userAId === userId ? row.userB : row.userA));
  }

  async unfriend(userId: string, otherUserId: string) {
    const [userAId, userBId] = this.canonicalPair(userId, otherUserId);
    const result = await this.prisma.friendship.deleteMany({
      where: { userAId, userBId },
    });
    if (result.count === 0) {
      throw new NotFoundException('Friendship not found');
    }
  }

  async areFriends(userId: string, otherUserId: string): Promise<boolean> {
    const [userAId, userBId] = this.canonicalPair(userId, otherUserId);
    const friendship = await this.prisma.friendship.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
    });
    return !!friendship;
  }

  private canonicalPair(a: string, b: string): [string, string] {
    return a < b ? [a, b] : [b, a];
  }
}
