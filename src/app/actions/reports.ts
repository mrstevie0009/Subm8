// src/app/actions/reports.ts
'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { randomUUID } from 'crypto';

// lokal (idempotent) die Tabelle anlegen – gleiche Struktur wie im Admin
async function ensureReportTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ContentReport" (
      "id" TEXT PRIMARY KEY,
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "targetType" TEXT NOT NULL,   -- 'POST' | 'USER'
      "targetId" TEXT NOT NULL,
      "reporterUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "reason" TEXT,
      "resolvedAt" TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ContentReport_target_idx"
    ON "ContentReport"("targetType","targetId") WHERE "resolvedAt" IS NULL;
  `);
}

export async function reportPostAction(formData: FormData) {
  'use server';
  const me = await getCurrentUser().catch(() => null);
  if (!me) throw new Error('Nicht angemeldet');

  const postId = String(formData.get('postId') ?? '');
  const reason = String(formData.get('reason') ?? 'OTHER');

  if (!postId) throw new Error('postId fehlt');

  await ensureReportTables();

  await prisma.$executeRaw`
    INSERT INTO "ContentReport" ("id","targetType","targetId","reporterUserId","reason")
    VALUES (${randomUUID()}, 'POST', ${postId}, ${me.id}, ${reason})
  `;
}
