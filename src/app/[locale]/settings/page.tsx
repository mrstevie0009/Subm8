import Link from 'next/link';
import { getCurrentUser } from '@/lib/currentUser';

type Params = { locale: string };

export default async function SettingsPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;

  // User laden (tolerant typisiert)
  const me = (await getCurrentUser().catch(() => null)) as
    | { handle?: string | null; displayName?: string | null }
    | null;

  const handle = me?.handle ?? '—';

  const items: Array<{
    href: string;
    title: string;
    desc: string;
    icon: React.ReactNode;
  }> = [
    {
      href: `/${locale}/profile`,
      title: 'Dein Account',
      desc:
        'Profilinfo ansehen und bearbeiten (Name, Bio, Avatar, Banner), Daten exportieren und Account-Optionen.',
      icon: <UserIcon />,
    },
    {
      href: `/${locale}/security`, // Platzhalter für „Sicherheit & Zugriff“
      title: 'Sicherheit & Zugriff',
      desc: 'Login-Sicherheit prüfen, verbundene Apps verwalten und Zugriff überwachen.',
      icon: <LockIcon />,
    },
    {
      href: `/${locale}/settings/premium`,
      title: 'Premium',
      desc: 'Vorteile ansehen und deine Premium-Einstellungen verwalten.',
      icon: <PremiumIcon />,
    },
    {
      href: `/${locale}/monetization`,
      title: 'Monetarisierung',
      desc: 'Vom Tip bis zur Community. Alle Wege zu stabilen Einnahmen.',
      icon: <MoneyIcon />,
    },
    {
      href: `/${locale}/settings`, // Platzhalter für „Datenschutz“
      title: 'Datenschutz',
      desc: 'Steuere, welche Informationen du siehst und teilst, und passe deine Privatsphäre an.',
      icon: <ShieldIcon />,
    },
    {
      href: `/${locale}/notifications`,
      title: 'Mitteilungen',
      desc: 'Lege fest, über welche Aktivitäten, Empfehlungen und Nachrichten du benachrichtigt wirst.',
      icon: <BellIcon />,
    },
    {
      href: `/${locale}/settings/bookmarks`,
      title: 'Bookmarks',
      desc: 'Gespeicherte Posts verwalten.',
      icon: <BookmarkIcon />,
    },
  ];

  return (
    <section className="rounded-app border border-sub overflow-hidden shadow-app">
      {/* Header mit lila Zurück-Pfeil (ohne Kreis), Titelblock leicht eingerückt */}
      <header className="px-4 pt-3 pb-4 border-b border-white/10">
        <div className="flex items-center">
          <Link
            href={`/${locale}`}
            aria-label="Zurück zum Feed"
            className="inline-flex items-center justify-center p-1 hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
            style={{ color: 'var(--purple)' }} // ⬅️ Pfeil in Lila
          >
            <ChevronLeftIcon />
          </Link>

          {/* Titelblock etwas nach rechts schieben */}
          <div className="ml-2 sm:ml-3">
            <h1 className="text-[22px] font-bold leading-tight">Einstellungen</h1>
            <div className="text-sm text-white/60">@{handle}</div>
          </div>
        </div>

        {/* Suche */}
        <div className="mt-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-80" aria-hidden>
              <SearchIcon />
            </span>
            <input
              type="search"
              placeholder="Einstellungen durchsuchen"
              className="w-full bg-white/5 border border-white/10 rounded-full pl-10 pr-3 h-10 outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
            />
          </div>
        </div>
      </header>

      {/* Menüliste */}
      <ul className="divide-y divide-white/10">
        {items.map((it) => (
          <li key={it.title}>
            <Link
              href={it.href}
              className="flex gap-4 px-4 py-4 hover:bg-white/[.04] transition"
            >
              {/* Icon links */}
              <span
                className="shrink-0 grid place-items-center rounded-xl w-11 h-11 bg-white/[.06] border border-white/10"
                style={{ color: 'var(--purple)' }}
                aria-hidden
              >
                {it.icon}
              </span>

              {/* Titel + Kurzbeschreibung */}
              <div className="min-w-0">
                <div className="text-[16px] font-medium">{it.title}</div>
                <div className="text-[13px] text-white/70 leading-snug mt-0.5">
                  {it.desc}
                </div>
              </div>

              {/* Chevron rechts */}
              <span className="ml-auto self-center text-white/40" aria-hidden>
                <ChevronRightIcon />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ===== Icons ===== */
function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16.5 16.5 21 21" strokeLinecap="round" />
    </svg>
  );
}
function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <circle cx="12" cy="7.5" r="3.5" />
      <path d="M4 19a8 8 0 0 1 16 0" strokeLinecap="round" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <rect x="4.5" y="10" width="15" height="9" rx="2" />
      <path d="M8 10V8a4 4 0 1 1 8 0v2" />
    </svg>
  );
}
function PremiumIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path d="M12 3 15 9l6 .9-4.4 4.2 1 6L12 17l-5.6 3.1 1-6L3 9.9 9 9l3-6Z" strokeLinejoin="round" />
    </svg>
  );
}
function MoneyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <rect x="3.5" y="6" width="17" height="12" rx="2.2" />
      <path d="M3.5 9.5h17" />
      <circle cx="17.5" cy="14.5" r="2.7" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path d="M12 3 5 6v6c0 5 7 9 7 9s7-4 7-9V6l-7-3Z" />
      <path d="m9.2 12.3 1.9 1.9 3.7-3.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path d="M19 17H5l1.5-2.5V10a5.5 5.5 0 1 1 11 0v4.5L19 17Z" />
      <path d="M12 21a2.5 2.5 0 0 0 2.3-1.5" strokeLinecap="round" />
    </svg>
  );
}
function BookmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path d="M7 4h10a1 1 0 0 1 1 1v15l-6-3-6 3V5a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
    </svg>
  );
}
