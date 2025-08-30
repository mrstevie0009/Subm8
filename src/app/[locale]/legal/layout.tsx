import Link from "next/link";

type Params = { locale: string };

export const dynamic = "force-static";

export default async function LegalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<Params>;
}) {
  const { locale } = await params;

  const items = [
    { href: `/${locale}/legal/community-guidelines`, label: "Community Guidelines" },
    { href: `/${locale}/legal/privacy`, label: "Datenschutzerklärung" },
    { href: `/${locale}/legal/terms`, label: "Terms of Service" },
    { href: `/${locale}/legal/age-verification`, label: "Age Verification" },
    { href: `/${locale}/legal/refunds`, label: "Refund Policy" },
    { href: `/${locale}/legal/impressum`, label: "Impressum" }
  ];

  return (
    <section className="rounded-xl border border-white/10 overflow-hidden">
      <header className="px-4 pt-3 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Link href={`/${locale}/settings`} className="p-1" aria-label="Zurück">
            <ChevronLeftIcon />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Recht &amp; Datenschutz</h1>
            <p className="text-sm text-white/60">Rechtliche Informationen und Richtlinien</p>
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
