// src/app/[locale]/(protected)/layout.tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import PageChrome from '@/components/PageChrome'

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: 'en' | 'de' | 'es' | 'fr' }>
}

export default async function ProtectedLayout({ children, params }: Props) {
  const { locale } = await params            // ⬅️ params awaiten
  const session = await auth()

  if (!session?.user?.id) {
    redirect(`/${locale}/signin`)
  }

  return <PageChrome locale={locale}>{children}</PageChrome>
}
