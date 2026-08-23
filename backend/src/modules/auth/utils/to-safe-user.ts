import { User } from '../../../../generated/prisma/client';

export type SafeUser = Pick<
  User,
  'id' | 'email' | 'username' | 'displayName' | 'avatarUrl' | 'createdAt'
>;

export function toSafeUser(user: User): SafeUser {
  const { id, email, username, displayName, avatarUrl, createdAt } = user;
  return { id, email, username, displayName, avatarUrl, createdAt };
}
