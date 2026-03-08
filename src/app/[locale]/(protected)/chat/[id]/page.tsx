// src/app/[locale]/(protected)/chat/[id]/page.tsx
'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import ClientThread from '@/components/chat/ClientThread';
import GroupThread from '@/components/chat/GroupThread';

export const dynamic = 'force-dynamic';

type MetaOk = {
  ok: true;
  id: string;
  type: 'DM' | 'GROUP';
  member: boolean;
  role?: 'ADMIN' | 'MEMBER';
  title?: string | null;
};
type MetaErr = { ok: false; error: string; type?: 'DM' | 'GROUP' };
type Meta = MetaOk | MetaErr;

export default function ChatThreadPage() {
  const { id } = useParams<{ id: string }>();
  const [meta, setMeta] = React.useState<Meta | null>(null);
  const [status, setStatus] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!id) return;
    let cancelled = false;
    
    (async () => {
      try {
        const res = await fetch(`/api/chat/meta/${id}`, { 
          cache: 'no-store',
          priority: 'high' as RequestPriority,
        });
        
        const j = (await res.json()) as Meta;
        if (cancelled) return;
        
        setStatus(res.status);
        setMeta(j);
      } catch (err) {
        if (!cancelled) {
          console.error('Meta fetch failed:', err);
          setStatus(500);
          setMeta({ ok: false, error: 'Network error' });
        }
      }
    })();
    
    return () => { cancelled = true; };
  }, [id]);

  if (!meta) {
    return <ClientThread />;
  }

  if (!meta.ok) {
    const msg =
      status === 401 ? 'Not authenticated' :
      status === 403 ? 'You do not have access to this conversation.' :
      meta.error || 'Unknown error';
    
    return (
      <main className="flex items-center justify-center min-h-[60vh] text-white/70">
        {msg}
      </main>
    );
  }

  return meta.type === 'GROUP' ? <GroupThread /> : <ClientThread />;
}