// src/lib/userStats.ts
import { prisma } from '@/lib/prisma';

export async function getFollowStats(userId: string) {
  const [followers, following] = await Promise.all([
    prisma.follow.count({ where: { followeeId: userId } }), // Follower = andere folgen mir
    prisma.follow.count({ where: { followerId: userId } }), // Following = ich folge anderen
  ]);
  return { followers, following };
}
