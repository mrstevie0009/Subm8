// src/app/signin-bridge/page.tsx
import { redirect } from 'next/navigation';

type SearchParams = {
  callbackUrl?: string;
  error?: string;
  [key: string]: string | string[] | undefined;
};

export default async function SignInBridge(
  { searchParams }: { searchParams: Promise<SearchParams> },
) {
  const sp = (await searchParams) || {};
  const callbackUrl = typeof sp.callbackUrl === 'string' ? sp.callbackUrl : '';
  let locale = 'en';

  try {
    // callbackUrl ist i. d. R. absolut (http://localhost:3000/en oder deine Domain)
    const FALLBACK = process.env.NEXTAUTH_URL ?? 'https://subm8.com/en';
    const u = new URL(callbackUrl || FALLBACK);
    const seg = u.pathname.split('/').filter(Boolean)[0];
    if (seg && /^[a-z]{2}$/.test(seg)) {
      locale = seg;
    }
  } catch {
    // ignore, fallback 'en'
  }

  // Querystring unverändert weiterreichen
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') qs.set(k, v);
  }

  redirect(`/${locale}/signin${qs.toString() ? `?${qs.toString()}` : ''}`);
}
