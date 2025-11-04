// src/app/[locale]/(public)/layout.tsx
import Image from 'next/image';
import Script from 'next/script';
import AuthScopeFlag from '@/components/AuthScopeFlag'; // ⬅ Import des Clients

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthScopeFlag />

      <div
        id="boot-splash"
        suppressHydrationWarning
        className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center
                   transition-opacity duration-300 will-change-[opacity]"
        aria-hidden
      >
        <Image
          src="/Sub m8.png"
          alt="Subm8 Logo"
          width={240}
          height={72}
          priority
          sizes="220px"
          className="w-[220px] h-auto"
        />
        <div
          id="boot-splash-lottie"
          className="mt-6 w-[260px] sm:w-[320px] h-[180px] sm:h-[220px]"
        />
      </div>

      {children}

      <Script id="boot-splash-script" strategy="afterInteractive">
        {`
          (function () {
            var splash = document.getElementById('boot-splash');
            if (!splash) return;
            var done = function () {
              splash.style.opacity = '0';
              setTimeout(function () {
                splash.style.display = 'none';
              }, 350);
            };
            window.addEventListener('boot:splash-done', done, { once: true });
            setTimeout(done, 3000);
          })();
        `}
      </Script>
    </>
  );
}
