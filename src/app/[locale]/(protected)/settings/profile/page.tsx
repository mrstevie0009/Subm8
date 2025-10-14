import Link from 'next/link';

export default async function SettingsProfile({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="sticky top-[calc(var(--header-h))] z-10 bg-black/80 backdrop-blur border-b border-white/10">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href={`/${locale}/settings`} className="rounded p-1 hover:bg-white/10" aria-label="Back">
            <BackIcon />
          </Link>
          <div>
            <h1 className="text-xl font-semibold leading-tight">Profile</h1>
            <p className="text-sm opacity-70">Edit how others see you</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="rounded-app border border-sub shadow-app p-6 text-center">
          <div className="mx-auto mb-2 w-12 h-12 grid place-items-center rounded-full bg-white/5 border border-white/10">
            <PencilIcon />
          </div>
          <h2 className="font-semibold mb-1">Edit Profile</h2>
          <p className="opacity-70 text-sm">Hook up your form here (EditProfileForm).</p>
        </div>
      </div>
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}
function PencilIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 20l4-1 9-9-3-3-9 9-1 4zM14 5l3 3" />
    </svg>
  );
}
