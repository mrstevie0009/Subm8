// src/app/[locale]/legal/layout.tsx
import Link from "next/link";
import BackButton from '@/components/BackButtonStandard';

// i18n: manuelles Laden + createTranslator
import { createTranslator } from 'next-intl';
import { notFound } from 'next/navigation';

type Params = { locale: string };

export const dynamic = "force-static";

export default async function LegalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const { locale } = await params;

  // i18n-Dateien manuell laden und Translatoren erstellen
  let tLegal: ReturnType<typeof createTranslator>;
  let tLegalPage: ReturnType<typeof createTranslator>;
  let tHome: ReturnType<typeof createTranslator>;

  try {
    const legalFile = (await import(`@/messages/${locale}/legal.json`)).default;
    const homeFile  = (await import(`@/messages/${locale}/home.json`)).default;

    // legal.* (z.B. legal.guidelines.title, legal.terms.title, …)
    tLegal = createTranslator({
      locale,
      messages: legalFile,
      namespace: 'legal'
    });

    // legalPage.* liegt als eigener Top-Level-Schlüssel im gleichen File
    tLegalPage = createTranslator({
      locale,
      messages: legalFile,
      namespace: 'legalPage'
    });

    // home.json hat KEIN "home"-Top-Level; für Namespace-Nutzung -> unter "home" wrappen
    tHome = createTranslator({
      locale,
      messages: { home: homeFile },
      namespace: 'home'
    });
  } catch {
    notFound();
  }

  const items = [
    { href: `/${locale}/legal/community-guidelines`, label: tLegal('guidelines.title') },
    { href: `/${locale}/legal/privacy`,              label: tLegal('privacy.title') },
    { href: `/${locale}/legal/terms`,                label: tLegal('terms.title') },
    { href: `/${locale}/legal/age-verification`,     label: tLegal('age.title') },
    { href: `/${locale}/legal/refunds`,              label: tLegal('refund.title') },
    { href: `/${locale}/legal/impressum`,            label: tLegal('imprint.title') }
  ];

  return (
    <section className="rounded-xl border border-white/10 overflow-hidden">
      <header className="px-4 pt-3 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <BackButton
            fallbackHref={`/${locale}`}
            ariaLabel={tHome('bookmarksPage.ariaBack')}
            className="inline-flex items-center justify-center p-1 hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
            style={{ color: 'var(--purple)' }}
          >
            <ChevronLeftIcon />
          </BackButton>
          <div className="ml-2 sm:ml-3">
            <h1 className="text-lg font-semibold">{tLegalPage('title')}</h1>
            <p className="text-sm text-white/60">{tLegalPage('subtitle')}</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 p-4">
        <nav className="rounded-lg border border-white/10 p-3 h-fit">
          <ul className="grid gap-1">
            {items.map((i) => (
              <li key={i.href}>
                <Link
                  href={i.href}
                  className="block px-3 py-2 rounded-md hover:bg-white/10 border border-transparent hover:border-white/10"
                >
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
    >
      <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
