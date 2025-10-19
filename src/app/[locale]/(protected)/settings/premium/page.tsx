// src/app/[locale]/settings/premium/page.tsx
import Link from "next/link";
import BackButton from "@/components/BackButtonStandard";

type Params = { locale: string };

export default async function PremiumPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { locale } = await params;

  return (
    <div
      className="
        min-h-[100svh]
        bg-black
        bg-gradient-to-b from-black to-[#0b0b0b]
        px-3 sm:px-4 py-4 sm:py-6
        pb-[max(1rem,env(safe-area-inset-bottom))]
      "
    >
      <section className="mx-auto max-w-3xl rounded-app border border-sub overflow-hidden shadow-app">
        {/* Hero-Header innerhalb der Karte (nicht sticky, da globaler Header ausgeblendet) */}
        <header
          className="
            relative px-4 pt-3 pb-5 border-b border-white/10
            bg-[radial-gradient(1200px_300px_at_20%_-40%,rgba(130,0,255,.25),transparent),radial-gradient(900px_220px_at_110%_-30%,rgba(0,140,255,.18),transparent)]
          "
        >
          <div className="flex items-start">
            <BackButton
              ariaLabel="Back"
              fallbackHref={`/${locale}`}
              className="inline-flex items-center justify-center p-1 rounded hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
              style={{ color: "var(--purple)" }}
            >
              <ChevronLeftIcon />
            </BackButton>

            <div className="ml-2 sm:ml-3">
              <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full border border-white/15 bg-white/5 text-[11px] text-white/80">
                <span className="inline-block size-1.5 rounded-full bg-yellow-400" />
                Coming soon
              </div>
              <h1 className="mt-2 text-[22px] sm:text-[24px] font-bold leading-tight">
                Premium
              </h1>
              <p className="text-sm text-white/70">
                Unlock more with Subm8 Premium
              </p>
            </div>
          </div>
        </header>

        {/* Inhalt */}
        <div className="p-4 grid gap-4">
          <section className="rounded-lg border border-white/10 p-5">
            <h2 className="text-base font-semibold mb-2">What’s planned</h2>
            <ul className="list-disc pl-5 text-white/90 space-y-1">
              <li>Priority in discovery</li>
              <li>Longer videos &amp; higher media limits</li>
              <li>Custom themes &amp; profile styling</li>
              <li>Early access to new features</li>
            </ul>
            <p className="mt-4 text-sm text-white/70">
              We’re gathering feedback before launch. Your input helps shape
              Premium.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/${locale}`}
                className="px-4 py-1.5 rounded-full border border-white/20 bg-white/5 hover:bg-white/10"
              >
                Back to feed
              </Link>
              <Link
                href={`/${locale}/settings`}
                className="px-4 py-1.5 rounded-full bg-[var(--purple)] text-white hover:opacity-95"
              >
                Give feedback
              </Link>
            </div>
          </section>

          <section className="rounded-lg border border-white/10 p-5">
            <h2 className="text-base font-semibold mb-2">FAQ</h2>
            <div className="text-sm text-white/85 space-y-3">
              <p>
                <span className="font-medium">When will it launch?</span> We’ll
                roll out after early user feedback.
              </p>
              <p>
                <span className="font-medium">
                  Will current features stay free?
                </span>{" "}
                Yes. Premium is optional and adds extras.
              </p>
            </div>
          </section>
        </div>
      </section>
    </div>
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
      aria-hidden="true"
    >
      <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
