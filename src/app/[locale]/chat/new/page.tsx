import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

type PageProps = {
  params: { locale: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function ChatNewPage({ params: { locale }, searchParams }: PageProps) {
  const me = await getCurrentUser();
  const raw = searchParams?.to;
  const toHandle = Array.isArray(raw) ? raw[0] : raw;

  // Kein Ziel -> zurück zur Chatliste
  if (!toHandle) redirect(`/${locale}/chat`);

  // Nicht eingeloggt -> zur Sign-in (zurück aufs Profil)
  if (!me) {
    const back = `/${locale}/u/${encodeURIComponent(toHandle)}`;
    redirect(`/${locale}/signin?callbackUrl=${encodeURIComponent(back)}`);
  }

  // Zieluser holen
  const other = await prisma.user.findUnique({
    where: { handle: toHandle },
    select: { id: true, role: true },
  });

  // Ungültig oder Self-DM -> zurück zur Chatliste
  if (!other || other.id === me.id) redirect(`/${locale}/chat`);

  // Rollen-Mapping in dommeId/subId
  // Normalfall: Domme↔Sub. Falls beide gleiche Rolle haben, deterministisch aufteilen.
  let dommeId: string;
  let subId: string;
  let openedByDomme = me.role === 'DOMME';

  if (me.role === 'DOMME' && other.role === 'SUBMISSIVE') {
    dommeId = me.id;
    subId = other.id;
  } else if (me.role === 'SUBMISSIVE' && other.role === 'DOMME') {
    dommeId = other.id;
    subId = me.id;
  } else {
    // gleiche Rollen: deterministische Reihenfolge nach ID
    if (me.id < other.id) {
      dommeId = me.id;
      subId = other.id;
    } else {
      dommeId = other.id;
      subId = me.id;
      openedByDomme = other.role === 'DOMME';
    }
  }

  // Existierende Conversation suchen
  const existing = await prisma.conversation.findFirst({
    where: { dommeId, subId },
    select: { id: true },
  });

  const convoId =
    existing?.id ??
    (
      await prisma.conversation.create({
        data: { dommeId, subId, openedByDomme },
        select: { id: true },
      })
    ).id;

  // Ab in den Thread
  redirect(`/${locale}/chat/${convoId}`);
}
