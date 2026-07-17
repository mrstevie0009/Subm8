// src/app/[locale]/(public)/layout.tsx
import AuthScopeFlag from '@/components/AuthScopeFlag';
import BootSplash from '@/components/BootSplash';

type PublicLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function PublicLayout({ children, params }: PublicLayoutProps) {
  // Wir brauchen locale hier nicht, aber Next 15 liefert es mit.
  await params;

  return (
    <>
      <AuthScopeFlag />
      <BootSplash />
      {children}
    </>
  );
}