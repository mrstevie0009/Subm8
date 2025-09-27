// src/app/api/me/basic/route.ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/currentUser';

export async function GET() {
  const u = await getCurrentUser();
  if (!u) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    me: {
      displayName: u.displayName,
      handle: u.handle,
      avatarUrl: u.avatarUrl,
      role: u.role, // 'DOMME' | 'SUBMISSIVE'
    },
  });
}
