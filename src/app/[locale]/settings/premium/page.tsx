// src/app/[locale]/settings/premium/page.tsx
import Link from "next/link";
import BackButton from "@/components/BackButtonStandard"; // ⬅️ NEU

type Params = { locale: string };

export default async function PremiumPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { locale } = await params;

  return (
    <section className="max-w-3xl mx-auto">
      {/* Header (sticky) */}
      <header className="sticky top-[calc(var(--header-h))] z-10 bg-black/80 backdrop-blur border-b border-white/10">
        <div className="px-4 py-3 flex items-center">
          <BackButton
            ariaLabel="Back"
            fallbackHref={`/${locale}`}
            className="inline-flex items-center justify-center p-1 rounded hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
            style={{ color: "var(--purple)" }}
          >
            <ChevronLeftIcon />
          </BackButton>
          <div className="ml-2 sm:ml-3">
            <h1 className="text-xl font-semibold">Premium</h1>
            <p className="text-sm opacity-70">Unlock more with Subm8 Premium</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-4 grid gap-4">
        <div className="rounded-app border border-sub shadow-app p-6">
          <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full border border-white/15 text-[12px] text-white/80 mb-3">
            <span className="inline-block size-2 rounded-full bg-yellow-400" />
            Coming soon
          </div>
          <h2 className="font-semibold mb-2">What’s planned</h2>
          <ul className="list-disc pl-5 opacity-90 space-y-1">
            <li>Priority in discovery</li>
            <li>Longer videos & media limits</li>
            <li>Custom themes & profile styling</li>
            <li>Early access to new features</li>
          </ul>
          <p className="mt-4 text-sm text-white/70">
            We’re gathering feedback before launch. Your input helps shape Premium.
          </p>
          <div className="mt-4 flex gap-2">
            <Link
              href={`/${locale}`}
              className="px-4 py-1.5 rounded-full border border-white/20 hover:bg-white/5"
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
        </div>

        <div className="rounded-app border border-sub shadow-app p-6">
          <h2 className="font-semibold mb-2">FAQ</h2>
          <div className="text-sm text-white/80 space-y-2">
            <p>
              <span className="font-medium">When will it launch?</span> We’ll roll out after early user feedback.
            </p>
            <p>
              <span className="font-medium">Will current features stay free?</span> Yes. Premium is optional and adds extras.
            </p>
          </div>
        </div>
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
      aria-hidden="true"
    >
      <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
