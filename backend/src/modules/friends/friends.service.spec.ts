import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { FriendsService } from './friends.service';

describe('FriendsService', () => {
  let service: FriendsService;
  let prisma: {
    user: { findUnique: jest.Mock; findMany: jest.Mock };
    friendRequest: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
    friendship: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), findMany: jest.fn() },
      friendRequest: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      friendship: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    service = new FriendsService(prisma as any);
  });

  describe('sendRequest', () => {
    it('throws NotFound when the target username does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.sendRequest('user-1', 'ghost')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('refuses a request to yourself', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        username: 'me',
      });

      await expect(service.sendRequest('user-1', 'me')).rejects.toThrow(
        ConflictException,
      );
    });

    it('refuses a request when already friends', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        username: 'friend',
      });
      prisma.friendship.findUnique.mockResolvedValue({ id: 'friendship-1' });

      await expect(service.sendRequest('user-1', 'friend')).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.friendRequest.create).not.toHaveBeenCalled();
    });

    it('refuses a duplicate-direction request when the other user already sent one', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        username: 'them',
      });
      prisma.friendship.findUnique.mockResolvedValue(null);
      prisma.friendRequest.findUnique.mockResolvedValue({
        id: 'existing-request',
      });

      await expect(service.sendRequest('user-1', 'them')).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.friendRequest.create).not.toHaveBeenCalled();
    });

    it('creates a request when none of the conflict conditions apply', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        username: 'them',
      });
      prisma.friendship.findUnique.mockResolvedValue(null);
      prisma.friendRequest.findUnique.mockResolvedValue(null);
      prisma.friendRequest.create.mockResolvedValue({ id: 'req-1' });

      await service.sendRequest('user-1', 'them');

      expect(prisma.friendRequest.create).toHaveBeenCalledWith({
        data: { fromUserId: 'user-1', toUserId: 'user-2' },
      });
    });
  });

  describe('searchUsers', () => {
    it('returns an empty array without querying when the trimmed query is empty', async () => {
      const result = await service.searchUsers('user-1', '   ');

      expect(result).toEqual([]);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('excludes the caller and matches username or display name case-insensitively', async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'user-2',
          username: 'manan',
          displayName: 'Manan Mer',
          avatarUrl: null,
        },
      ]);
      prisma.friendship.findMany.mockResolvedValue([]);
      prisma.friendRequest.findMany.mockResolvedValue([]);

      await service.searchUsers('user-1', 'man');

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: { not: 'user-1' },
            OR: [
              { username: { contains: 'man', mode: 'insensitive' } },
              { displayName: { contains: 'man', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });

    it('annotates each result with FRIENDS, REQUEST_SENT, REQUEST_RECEIVED, or NONE', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'friend-1', username: 'a' },
        { id: 'sent-to-1', username: 'b' },
        { id: 'received-from-1', username: 'c' },
        { id: 'stranger-1', username: 'd' },
      ]);
      prisma.friendship.findMany.mockResolvedValue([
        { userAId: 'user-1', userBId: 'friend-1' },
      ]);
      prisma.friendRequest.findMany.mockImplementation(({ where }: any) => {
        if (where.fromUserId) return [{ toUserId: 'sent-to-1' }];
        return [{ fromUserId: 'received-from-1' }];
      });

      const result = await service.searchUsers('user-1', 'x');

      expect(result).toEqual([
        { id: 'friend-1', username: 'a', status: 'FRIENDS' },
        { id: 'sent-to-1', username: 'b', status: 'REQUEST_SENT' },
        { id: 'received-from-1', username: 'c', status: 'REQUEST_RECEIVED' },
        { id: 'stranger-1', username: 'd', status: 'NONE' },
      ]);
    });

    it('skips the relationship lookups entirely when there are no matches', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.searchUsers('user-1', 'nobody');

      expect(result).toEqual([]);
      expect(prisma.friendship.findMany).not.toHaveBeenCalled();
      expect(prisma.friendRequest.findMany).not.toHaveBeenCalled();
    });
  });

  describe('acceptRequest', () => {
    it('throws NotFound if the request does not exist or was not sent to this user', async () => {
      prisma.friendRequest.findFirst.mockResolvedValue(null);

      await expect(service.acceptRequest('user-2', 'req-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.friendship.create).not.toHaveBeenCalled();
    });

    it('creates the friendship with the canonical (sorted) user order, then deletes the request', async () => {
      prisma.friendRequest.findFirst.mockResolvedValue({
        id: 'req-1',
        fromUserId: 'zzz-user',
        toUserId: 'aaa-user',
      });
      prisma.friendship.create.mockResolvedValue({ id: 'friendship-1' });

      await service.acceptRequest('aaa-user', 'req-1');

      expect(prisma.friendship.create).toHaveBeenCalledWith({
        data: { userAId: 'aaa-user', userBId: 'zzz-user' },
      });
      expect(prisma.friendRequest.delete).toHaveBeenCalledWith({
        where: { id: 'req-1' },
      });
    });

    it('still deletes the request if the friendship already exists (idempotent retry)', async () => {
      prisma.friendRequest.findFirst.mockResolvedValue({
        id: 'req-1',
        fromUserId: 'user-1',
        toUserId: 'user-2',
      });
      const duplicateError = Object.assign(new Error('duplicate'), {
        code: 'P2002',
      });
      Object.setPrototypeOf(
        duplicateError,
        Prisma.PrismaClientKnownRequestError.prototype,
      );
      prisma.friendship.create.mockRejectedValue(duplicateError);

      await service.acceptRequest('user-2', 'req-1');

      expect(prisma.friendRequest.delete).toHaveBeenCalledWith({
        where: { id: 'req-1' },
      });
    });
  });

  describe('rejectRequest', () => {
    it('throws NotFound if the request was not sent to this user', async () => {
      prisma.friendRequest.findFirst.mockResolvedValue(null);

      await expect(service.rejectRequest('user-2', 'req-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes the request without creating any friendship', async () => {
      prisma.friendRequest.findFirst.mockResolvedValue({ id: 'req-1' });

      await service.rejectRequest('user-2', 'req-1');

      expect(prisma.friendship.create).not.toHaveBeenCalled();
      expect(prisma.friendRequest.delete).toHaveBeenCalledWith({
        where: { id: 'req-1' },
      });
    });
  });

  describe('listFriends', () => {
    it("returns the other user in each friendship, regardless of which side of the row you're on", async () => {
      prisma.friendship.findMany.mockResolvedValue([
        {
          userAId: 'user-1',
          userBId: 'user-2',
          userA: { id: 'user-1' },
          userB: { id: 'user-2' },
        },
        {
          userAId: 'user-3',
          userBId: 'user-1',
          userA: { id: 'user-3' },
          userB: { id: 'user-1' },
        },
      ]);

      const result = await service.listFriends('user-1');

      expect(result).toEqual([{ id: 'user-2' }, { id: 'user-3' }]);
    });
  });

  describe('unfriend', () => {
    it('throws NotFound when no friendship exists', async () => {
      prisma.friendship.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.unfriend('user-1', 'user-2')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes using the canonical sorted order regardless of call-site argument order', async () => {
      prisma.friendship.deleteMany.mockResolvedValue({ count: 1 });

      await service.unfriend('zzz-user', 'aaa-user');

      expect(prisma.friendship.deleteMany).toHaveBeenCalledWith({
        where: { userAId: 'aaa-user', userBId: 'zzz-user' },
      });
    });
  });

  describe('areFriends', () => {
    it('returns true when a friendship row exists in canonical order', async () => {
      prisma.friendship.findUnique.mockResolvedValue({ id: 'friendship-1' });

      const result = await service.areFriends('zzz-user', 'aaa-user');

      expect(prisma.friendship.findUnique).toHaveBeenCalledWith({
        where: {
          userAId_userBId: { userAId: 'aaa-user', userBId: 'zzz-user' },
        },
      });
      expect(result).toBe(true);
    });

    it('returns false when no friendship row exists', async () => {
      prisma.friendship.findUnique.mockResolvedValue(null);

      expect(await service.areFriends('user-1', 'user-2')).toBe(false);
    });
  });
});
