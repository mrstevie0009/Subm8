// src/app/[locale]/layout.tsx
import '../globals.css';
import { NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import Providers from '@/components/Providers';

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function RootLayout({ children, params }: LayoutProps) {
  const { locale } = await params;

  let messages: Record<string, unknown>;
  try {
    const postCommon       = (await import(`../../messages/${locale}/common.json`)).default;
    const postFile         = (await import(`../../messages/${locale}/post.json`)).default;          // { post: {...} }
    const verifyFile       = (await import(`../../messages/${locale}/verify.json`)).default;        // { verify: {...} }
    const home             = (await import(`../../messages/${locale}/home.json`)).default;
    const settings         = (await import(`../../messages/${locale}/settings.json`)).default;
    const comments         = (await import(`../../messages/${locale}/comments.json`)).default;
    const profile          = (await import(`../../messages/${locale}/profile.json`)).default;
    const offer            = (await import(`../../messages/${locale}/offer.json`)).default;
    const search           = (await import(`../../messages/${locale}/search.json`)).default;
    const notifications    = (await import(`../../messages/${locale}/notifications.json`)).default;
    const communitiesFile  = (await import(`../../messages/${locale}/communities.json`)).default;
    const chatFile         = (await import(`../../messages/${locale}/chat.json`)).default;
    const authFile         = (await import(`../../messages/${locale}/auth.json`)).default;
    const legalFile        = (await import(`../../messages/${locale}/legal.json`)).default;
    const paymentFile      = (await import(`../../messages/${locale}/payments.json`)).default;
    const ownershipFile    = (await import(`../../messages/${locale}/ownership.json`)).default;
    const monetizationFile = (await import(`../../messages/${locale}/monetization.json`)).default;

    messages = {
      post: postFile.post,
      verify: verifyFile.verify,
      common: postCommon,
      home,
      settings,
      comments: comments.comments,
      profile,
      offer,
      search: search.search,
      notifications,
      communities: communitiesFile,
      chat: chatFile,
      auth: authFile,
      legal: legalFile,
      payment: paymentFile,
      ownership: ownershipFile,
      monetization: monetizationFile.monetizationPage,
    };
  } catch {
    notFound();
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <Providers>{children}</Providers>
    </NextIntlClientProvider>
  );
}
