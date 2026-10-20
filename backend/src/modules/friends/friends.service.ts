import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { MailService } from '../mail/mail.service';
import { renderFriendRequestAcceptedEmail } from '../mail/templates/friend-request-accepted.template';
import { renderFriendRequestReceivedEmail } from '../mail/templates/friend-request-received.template';

const PUBLIC_PROFILE_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

// The public-garage fields a friend email may show — specs only.
const GARAGE_CAR_SELECT = {
  make: true,
  model: true,
  year: true,
  variant: true,
  fuelType: true,
} as const;

@Injectable()
export class FriendsService {
  private readonly logger = new Logger(FriendsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

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

    const request = await this.prisma.friendRequest.create({
      data: { fromUserId, toUserId: toUser.id },
    });
    await this.notifyRequestReceived(fromUserId, toUser);
    return request;
  }

  // Case-insensitive substring match on username or display name, annotated
  // with the caller's relationship to each result so the UI can grey out
  // "Send" for someone already a friend or already invited instead of
  // letting the request round-trip into a predictable 409.
  async searchUsers(userId: string, query: string) {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const users = await this.prisma.user.findMany({
      where: {
        id: { not: userId },
        OR: [
          { username: { contains: trimmed, mode: 'insensitive' } },
          { displayName: { contains: trimmed, mode: 'insensitive' } },
        ],
      },
      select: PUBLIC_PROFILE_SELECT,
      orderBy: { username: 'asc' },
      take: 8,
    });
    if (users.length === 0) return [];

    // Sequential, not Promise.all — see Section 0's Prisma driver-adapter gotcha.
    const friendships = await this.prisma.friendship.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
    });
    const outgoing = await this.prisma.friendRequest.findMany({
      where: { fromUserId: userId },
    });
    const incoming = await this.prisma.friendRequest.findMany({
      where: { toUserId: userId },
    });
    const friendIds = new Set(
      friendships.map((f) => (f.userAId === userId ? f.userBId : f.userAId)),
    );
    const outgoingIds = new Set(outgoing.map((r) => r.toUserId));
    const incomingIds = new Set(incoming.map((r) => r.fromUserId));

    return users.map((u) => ({
      ...u,
      status: friendIds.has(u.id)
        ? ('FRIENDS' as const)
        : outgoingIds.has(u.id)
          ? ('REQUEST_SENT' as const)
          : incomingIds.has(u.id)
            ? ('REQUEST_RECEIVED' as const)
            : ('NONE' as const),
    }));
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
    await this.notifyRequestAccepted(req.fromUserId, userId);
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

  // The reads an email needs are awaited here rather than in the background:
  // gotcha #1 means they must not overlap the request's own queries. Only
  // the SMTP send runs detached. Never throws — the friend request itself
  // already succeeded, and a missing email must not turn it into a 500.
  private async notifyRequestReceived(
    senderId: string,
    recipient: {
      email: string;
      username: string;
      displayName: string | null;
      avatarUrl: string | null;
    },
  ) {
    try {
      const sender = await this.prisma.user.findUnique({
        where: { id: senderId },
        select: PUBLIC_PROFILE_SELECT,
      });
      if (!sender) return;
      const senderCars = await this.garageOf(senderId);
      void this.mail.send(
        recipient.email,
        renderFriendRequestReceivedEmail({
          appUrl: this.mail.appUrl,
          recipient,
          sender,
          senderCars,
        }),
      );
    } catch (error) {
      this.logger.error(
        `Could not prepare friend-request email: ${(error as Error).message}`,
      );
    }
  }

  private async notifyRequestAccepted(requesterId: string, accepterId: string) {
    try {
      const recipient = await this.prisma.user.findUnique({
        where: { id: requesterId },
        select: { ...PUBLIC_PROFILE_SELECT, email: true },
      });
      const accepter = await this.prisma.user.findUnique({
        where: { id: accepterId },
        select: PUBLIC_PROFILE_SELECT,
      });
      if (!recipient || !accepter) return;
      const accepterCars = await this.garageOf(accepterId);
      void this.mail.send(
        recipient.email,
        renderFriendRequestAcceptedEmail({
          appUrl: this.mail.appUrl,
          recipient,
          accepter,
          accepterCars,
        }),
      );
    } catch (error) {
      this.logger.error(
        `Could not prepare request-accepted email: ${(error as Error).message}`,
      );
    }
  }

  private garageOf(userId: string) {
    return this.prisma.car.findMany({
      where: { userId },
      select: GARAGE_CAR_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  private canonicalPair(a: string, b: string): [string, string] {
    return a < b ? [a, b] : [b, a];
  }
}
