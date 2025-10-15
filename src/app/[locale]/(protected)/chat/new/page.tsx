// src/app/[locale]/chat/new/page.tsx
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

type PageProps = {
  // asynchrone params/searchParams (Next.js neuere Versionen)
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ChatNewPage(props: PageProps) {
  const { params, searchParams } = props;
  const { locale } = await params;
  const sp = searchParams ? await searchParams : undefined;

  const rawTo = sp?.to;
  const toHandle = Array.isArray(rawTo) ? rawTo[0] : rawTo;

  const rawText = sp?.text;
  const initialText = Array.isArray(rawText) ? rawText[0] : rawText;

  // Kein Ziel -> zurück zur Chatliste
  if (!toHandle) redirect(`/${locale}/chat`);

  const me = await getCurrentUser();

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

  // Rollen-Mapping
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
    if (me.id < other.id) {
      dommeId = me.id;
      subId = other.id;
    } else {
      dommeId = other.id;
      subId = me.id;
      openedByDomme = other.role === 'DOMME';
    }
  }

  // Existierende Conversation suchen/erstellen
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

  // Wenn initialer Text vorhanden ist, reiche ihn via Query-Param in den Thread weiter.
  // Der Thread sendet ihn beim ersten Laden automatisch (und entfernt den Param).
  const hint = `&hint=${openedByDomme ? 'domme->sub' : 'sub->domme'}`;
  const next = `/${locale}/chat/${convoId}${initialText ? `?text=${encodeURIComponent(initialText)}${hint}` : ''}`;

  redirect(next);
}
