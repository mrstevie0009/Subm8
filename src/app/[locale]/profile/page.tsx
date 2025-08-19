// src/app/[locale]/settings/page.tsx
import Link from 'next/link';

type Params = { params: Promise<{ locale: 'en' | 'de' }> };

export default async function SettingsHome({ params }: Params) {
  const { locale } = await params;

  return (
    <section className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <header className="mb-4 sm:mb-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-white/60">
          Manage your profile and account preferences.
        </p>
      </header>

      <nav className="grid gap-3">
        <SettingLink href={`/${locale}/settings/profile`} label="Edit Profile" hint="@name, bio, avatar, banner" />
        {/* Du kannst hier später weitere Punkte ergänzen */}
        {/* <SettingLink href={`/${locale}/settings/account`} label="Account" hint="Email, password" /> */}
        {/* <SettingLink href={`/${locale}/settings/privacy`} label="Privacy & safety" hint="Visibility, NSFW" /> */}
      </nav>
    </section>
  );
}

function SettingLink({ href, label, hint }: { href: string; label: string; hint?: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl border border-white/10 bg-card px-4 py-3 hover:bg-white/5"
    >
      <div>
        <div className="font-medium">{label}</div>
        {hint ? <div className="text-xs text-white/60">{hint}</div> : null}
      </div>
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        aria-hidden="true"
        className="text-white/70"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </Link>
  );
}
