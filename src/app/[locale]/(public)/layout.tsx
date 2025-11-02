// src/app/[locale]/(public)/layout.tsx
import Image from 'next/image';
import Script from 'next/script'; // ← NEU

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* SSR: Splash ist beim allerersten Paint sichtbar */}
      <div
        id="boot-splash"
        suppressHydrationWarning
        className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center
                        transition-opacity duration-300 will-change-[opacity]"
        aria-hidden
      >
        {/* Statisches Logo ist sofort sichtbar (auch ohne JS) */}
        <Image
          src="/Sub m8.png"
          alt="Subm8 Logo"
          width={240}
          height={72}
          priority
          sizes="220px"
          className="w-[220px] h-auto"
        />
        {/* Hier wird die Lottie per Portal aus der Signin-Page reingemounted */}
        <div id="boot-splash-lottie" className="mt-6 w-[260px] sm:w-[320px] h-[180px] sm:h-[220px]" />
      </div>

      {children}

      {/* Mini-Script: Splash ausblenden, sobald Event kommt – plus Safety-Timeout */}
      <Script id="boot-splash-script" strategy="afterInteractive">
      {`
        (function () {
          var splash = document.getElementById('boot-splash');
          if (!splash) return;
          var done = function () {
            if (!splash) return;
            splash.style.opacity = '0';
            setTimeout(function () { splash && splash.remove(); }, 350);
          };
          // App meldet fertig (Lottie onComplete) -> ausblenden
          window.addEventListener('boot:splash-done', done, { once: true });
          // Falls nie gemeldet wird: nach 3s ausblenden
          setTimeout(done, 3000);
        })();
      `}
      </Script>
    </>
  );
}
