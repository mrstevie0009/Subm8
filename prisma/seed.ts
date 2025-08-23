import { PrismaClient, Role } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // idempotent: vorhandene Nutzer bleiben bestehen
  const users = [
    { handle: 'user1000', displayName: 'User1000', role: Role.SUBMISSIVE, location: 'Graz, AT' },
    { handle: 'evelin',   displayName: 'Evelin',   role: Role.DOMME,      location: 'Vienna, AT' },
    { handle: 'maya',     displayName: 'Maya the bad ass', role: Role.DOMME, location: 'Berlin, DE' },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { handle: u.handle },
      update: {},
      create: u,
    });
  }

  // optional: ein Follow, damit Zahlen nicht 0 sind
  const sub = await prisma.user.findUnique({ where: { handle: 'user1000' } });
  const dom = await prisma.user.findUnique({ where: { handle: 'evelin' } });
  if (sub && dom) {
    await prisma.follow.upsert({
      where: { followerId_followeeId: { followerId: sub.id, followeeId: dom.id } },
      update: {},
      create: { followerId: sub.id, followeeId: dom.id },
    });
  }
}

main().finally(() => prisma.$disconnect());
