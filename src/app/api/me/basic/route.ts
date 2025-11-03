// src/app/api/me/basic/route.ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/currentUser';
import { prisma } from '@/lib/prisma'; 

export async function GET() {
  const u = await getCurrentUser();
  if (!u) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  // ⬇️ Sicherstellen, dass wir premiumUntil & isFirstAdopter wirklich haben
  const row = await prisma.user.findUnique({
    where: { id: u.id },
    select: {
      displayName: true,
      handle: true,
      avatarUrl: true,
      role: true,              // 'DOMME' | 'SUBMISSIVE'
      premiumUntil: true,     
      isFirstAdopter: true,    
    },
  });

  if (!row) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    me: {
      displayName: row.displayName,
      handle: row.handle,
      avatarUrl: row.avatarUrl,
      role: row.role,
      premiumUntil: row.premiumUntil,     
      isFirstAdopter: row.isFirstAdopter,  
    },
  });
}
