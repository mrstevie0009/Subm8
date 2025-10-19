// src/app/[locale]/(protected)/page.tsx
import HomeFeedClient from '@/components/HomeFeedClient';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type Params = { locale: string };

export default async function HomePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { locale } = await params;

  // Schneller Auth-Guard (kein schweres DB-Prefetch mehr)
  const session = await auth();
  if (!session?.user?.id) {
    const back = `/${locale}`;
    redirect(`/${locale}/signin?callbackUrl=${encodeURIComponent(back)}`);
  }

  // Sofort den Shell rendern – Feed lädt clientseitig
  return (
    <section className="grid gap-3">
      <HomeFeedClient initialItems={[]} />
    </section>
  );
}
