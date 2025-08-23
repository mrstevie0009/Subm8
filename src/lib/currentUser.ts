import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { Role } from '@prisma/client';

type UserShape = { id: string; handle: string; role: Role };

function isUserShape(u: unknown): u is UserShape {
  if (!u || typeof u !== 'object') return false;
  const o = u as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.handle === 'string' &&
    typeof o.role === 'string'
  );
}

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isUserShape(session.user)) return null;
  return {
    id: session.user.id,
    handle: session.user.handle,
    role: session.user.role,
  };
}
