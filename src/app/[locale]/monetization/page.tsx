// src/app/[locale]/monetization/page.tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import BackButton from '@/components/BackButtonStandard';

type Params = { locale: string };

export const dynamic = "force-static";

export default async function MonetizationPage({ params }: { params: Params }) {
  const { locale } = params;

  // Serverseitig laden – vermeidet Hook/Hydration-Probleme
  const t = await getTranslations({ locale, namespace: "common.monetizationPage" });

  // Helpers
  const list = (key: string): string[] => {
    const v = t.raw(key) as unknown;
    return Array.isArray(v) ? (v as string[]) : typeof v === "string" ? [v] : [];
  };
  const str = (key: string, fallback = ""): string => {
    const val = t(key);
    // Falls next-intl den Key-Namen zurückgibt, nutze Fallback
    return typeof val === "string" && !val.includes(".") ? val : fallback || val;
  };

  return (
    <section className="rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <header className="px-4 pt-3 pb-5 border-b border-white/10 bg-gradient-to-b from-white/5 to-transparent">
        <div className="flex items-center gap-2">
          <BackButton
                    fallbackHref={`/${locale}`}
                    ariaLabel={t('bookmarksPage.ariaBack')}
                    className="inline-flex items-center justify-center p-1 hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
                    style={{ color: 'var(--purple)' }}
                  >
                    <ChevronLeftIcon />
                  </BackButton>
          <div className="flex items-center gap-3">
            <CoinIcon className="w-6 h-6 opacity-80" />
            <div>
              <h1 className="text-lg font-semibold">{str("title", "Monetization")}</h1>
              <p className="text-sm text-white/60">{str("subtitle")}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Hero / KPIs */}
      <div className="p-4 md:p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <HeroCard
            title={str("hero.walletRealtime.title")}
            text={str("hero.walletRealtime.text")}
          />
          <HeroCard
            title={str("hero.flexibleSources.title")}
            text={str("hero.flexibleSources.text")}
          />
          <HeroCard
            title={str("hero.clearTransparent.title")}
            text={str("hero.clearTransparent.text")}
          />
        </div>
      </div>

      {/* Methods */}
      <div className="p-4 md:p-6 grid gap-6">
        {/* 1. Tips */}
        <MethodCard
          number={str("Direct tips (tributes)", "1")}
          title={str("methods.tips.title")}
          badge={str("methods.tips.badge")}
          icon={<LightningIcon className="w-5 h-5" />}
          bullets={list("methods.tips.bullets")}
          steps={list("methods.tips.steps")}
          ctas={[
            { label: str("methods.tips.ctaBackToSettings", "Back to Settings"), href: `/${locale}/settings` },
          ]}
        />

        {/* 2. Pay-per-View */}
        <MethodCard
          number={str("Pay-per-view (optional)", "2")}
          title={str("methods.ppv.title")}
          badge={str("methods.ppv.badge")}
          icon={<EyeIcon className="w-5 h-5" />}
          bullets={list("methods.ppv.bullets")}
          steps={list("methods.ppv.steps")}
        />

        {/* 3. Custom Tributes */}
        <MethodCard
          number={str("Custom tributes (drainer / tribute timer)", "3")}
          title={str("methods.customTributes.title")}
          badge={str("methods.customTributes.badge")}
          icon={<RepeatIcon className="w-5 h-5" />}
          bullets={list("methods.customTributes.bullets")}
          steps={list("methods.customTributes.steps")}
        />

        {/* 4. Paid Communities */}
        <MethodCard
          number={str("Community contributions (paid communities)", "4")}
          title={str("methods.paidCommunities.title")}
          badge={str("methods.paidCommunities.badge")}
          icon={<UsersIcon className="w-5 h-5" />}
          bullets={list("methods.paidCommunities.bullets")}
          steps={list("methods.paidCommunities.steps")}
          ctas={[
            { label: str("methods.paidCommunities.ctaOpenCommunities", "Open communities"), href: `/${locale}/communities` },
          ]}
        />

        {/* 5. Payouts */}
        <MethodCard
          number={str("methods.payouts.number", "5")}
          title={str("methods.payouts.title")}
          badge={str("methods.payouts.badge")}
          icon={<BankIcon className="w-5 h-5" />}
          bullets={list("methods.payouts.bullets")}
          steps={list("methods.payouts.steps")}
          note={str("methods.payouts.note")}
        />

        {/* 6. Leaderboard */}
        <MethodCard
          number={str("Leaderboard & badges (gamification)", "6")}
          title={str("methods.leaderboardBadges.title")}
          badge={str("methods.leaderboardBadges.badge")}
          icon={<TrophyIcon className="w-5 h-5" />}
          bullets={list("methods.leaderboardBadges.bullets")}
          steps={list("methods.leaderboardBadges.steps")}
        />
      </div>

      {/* Fees clarity */}
      <div className="p-4 md:p-6">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 md:p-5">
          <h3 className="text-base font-semibold mb-2">{str("fees.title", "Fees")}</h3>
          <ul className="text-sm text-white/80 list-disc pl-5 space-y-1">
            {list("fees.bullets").map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Helpful links */}
      <div className="p-4 md:p-6 pb-8">
        <div className="flex flex-wrap gap-3">
          <LinkButton href={`/${locale}/security`} label={str("links.security", "Security & access")} />
          <LinkButton href={`/${locale}/profile`} label={str("links.profile", "Optimize profile")} />
          <LinkButton href={`/${locale}`} label={str("links.feed", "Back to feed")} variant="ghost" />
        </div>
      </div>
    </section>
  );
}

/* ======= Small building blocks ======= */

function HeroCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <h3 className="text-base font-semibold mb-1">{title}</h3>
      <p className="text-sm text-white/70">{text}</p>
    </div>
  );
}

type CTA = { label: string; href: string };

function MethodCard(props: {
  number: string | number;
  title: string;
  badge?: string;
  icon?: React.ReactNode;
  bullets: string[];
  steps?: string[];
  ctas?: CTA[];
  note?: string;
}) {
  const { number, title, badge, icon, bullets, steps, ctas, note } = props;
  // statischer Text aus common.monetizationPage.methodCard:
  // Wir lassen diese Komponente dumb und übergeben nur Plain-Strings.
  return (
    <section className="rounded-lg border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/10 text-sm font-semibold">
            {number}
          </span>
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="shrink-0">{icon}</span>
            <h2 className="text-base font-semibold">{title}</h2>
          </div>
        </div>
        {badge ? (
          <span className="text-[11px] px-2 py-1 rounded-full bg-white/10 border border-white/15">
            {badge}
          </span>
        ) : null}
      </div>

      <div className="p-4 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold mb-2">Was ist das?</h3>
          <ul className="text-sm text-white/80 list-disc pl-5 space-y-1">
            {bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>

        {steps && steps.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold mb-2">So funktioniert’s</h3>
            <ol className="text-sm text-white/80 list-decimal pl-5 space-y-1">
              {steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
        ) : (
          <div className="rounded-md border border-white/10 bg-white/5 p-3 text-sm text-white/70">
            {/* Fallback-Text in Deutsch; wenn du ihn i18n willst, gib ihn als Prop rein */}
            Nutze dieses Feature, wenn es zu deiner Audience passt – Preisgestaltung und Messaging
            sind entscheidend.
          </div>
        )}
      </div>

      {note ? (
        <div className="px-4 pb-3">
          <div className="rounded-md border border-white/10 bg-yellow-500/10 text-yellow-200/90 px-3 py-2 text-[13px]">
            {note}
          </div>
        </div>
      ) : null}

      {ctas && ctas.length > 0 ? (
        <div className="px-4 pb-4">
          <div className="flex flex-wrap gap-2">
            {ctas.map((c, i) => (
              <Link
                key={i}
                href={c.href}
                className="px-3 py-1.5 text-sm rounded-full bg-white/10 hover:bg-white/15 border border-white/15"
              >
                {c.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function LinkButton({
  href,
  label,
  variant = "solid",
}: {
  href: string;
  label: string;
  variant?: "solid" | "ghost";
}) {
  return (
    <Link
      href={href}
      className={[
        "px-4 py-2 rounded-full border",
        variant === "ghost"
          ? "border-white/15 bg-transparent hover:bg-white/10"
          : "border-white/15 bg-white/10 hover:bg-white/15",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

/* ======= Icons (inline, keine externen Libs) ======= */

function ChevronLeftIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      aria-hidden="true"
    >
      <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CoinIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 9.5c1.2-1 2.7-1.5 3.9-1.5 2.6 0 3.6 1.5 3.6 2.8 0 3.1-6.1 1.8-6.1 4.7 0 1.2 1 2.5 3.2 2.5 1 0 2.2-.2 3.2-.8" />
    </svg>
  );
}
function LightningIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M11 21 19 8h-6l2-7L5 12h6v9z" />
    </svg>
  );
}
function EyeIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  );
}
function RepeatIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}
function UsersIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M16 11c1.9 0 3.5-1.6 3.5-3.5S17.9 4 16 4s-3.5 1.6-3.5 3.5S14.1 11 16 11Z" />
      <path d="M8 13c2.2 0 4-1.8 4-4S10.2 5 8 5 4 6.8 4 9s1.8 4 4 4Z" />
      <path d="M2 20a6 6 0 0 1 12 0" />
      <path d="M12.5 18a4.5 4.5 0 0 1 9 0" />
    </svg>
  );
}
function BankIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M3 10h18" />
      <path d="M5 10v8M9 10v8M15 10v8M19 10v8" />
      <path d="M2 20h20" />
      <path d="M12 4 3 8h18L12 4Z" />
    </svg>
  );
}
function TrophyIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 3h10v4a5 5 0 0 1-10 0V3Z" />
      <path d="M17 5h3a3 3 0 0 1-3 3" />
      <path d="M7 5H4a3 3 0 0 0 3 3" />
    </svg>
  );
}
