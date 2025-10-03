// src/app/[locale]/layout.tsx
import '../globals.css'
import { NextIntlClientProvider } from 'next-intl'
import { notFound } from 'next/navigation'
import { Inter } from 'next/font/google'
import PageChrome from '@/components/PageChrome'
import Providers from '@/components/Providers'

const inter = Inter({ subsets: ['latin'], weight: ['400','500','600','700'], display: 'swap' })

type LayoutProps = {
  children: React.ReactNode
  params: Promise<{ locale: 'en' | 'de' | 'es' | 'fr' }>
}

export default async function RootLayout({ children, params }: LayoutProps) {
  const { locale } = await params

  let messages: Record<string, unknown>
  try {
    messages = (await import(`../../messages/${locale}/common.json`)).default
  } catch {
    notFound()
  }

  return (
    <html lang={locale}>
      <body className={`${inter.className} bg-black text-white`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <PageChrome locale={locale}>{children}</PageChrome>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
