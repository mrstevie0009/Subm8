'use client';

/**
 * BootSplash — selbstverwalteter Start-Splash (Logo + Lottie).
 * 
 * - blendet aus, sobald die Lottie fertig ist (onComplete)
 * - harter Fallback nach 3,2 s — auch wenn der Lottie-Chunk nie lädt
 * - wird pro Browser-Session nur EINMAL gezeigt (sessionStorage);
 *   bei Client-Navigationen zurück auf die Public-Seiten erscheint
 *   kein Splash mehr → der "hängt fest bis Reload"-Bug ist damit weg
 * - feuert weiterhin das Event 'boot:splash-done' (Kompatibilität,
 *   z. B. für signup/account)
 */

import * as React from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

import heartThrow from '@/lotties/heart-throw-Lottie.json';

const SESSION_KEY = 'subm8:boot-splash-shown';
const HARD_TIMEOUT_MS = 3200;
const FADE_MS = 350;

export default function BootSplash() {
  // 'boot' → sichtbar, 'fading' → Opacity-Transition, 'gone' → unmounted
  const [phase, setPhase] = React.useState<'boot' | 'fading' | 'gone'>('boot');
  const doneRef = React.useRef(false);

  const finish = React.useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {}
    window.dispatchEvent(new Event('boot:splash-done')); // Kompatibilität
    setPhase('fading');
    window.setTimeout(() => setPhase('gone'), FADE_MS);
  }, []);

  // Schon in dieser Session gezeigt? Dann vor dem ersten Paint verschwinden.
  React.useLayoutEffect(() => {
    let shown = false;
    try {
      shown = sessionStorage.getItem(SESSION_KEY) === '1';
    } catch {}
    if (shown) {
      doneRef.current = true;
      setPhase('gone');
    }
  }, []);

  // Harter Fallback: Splash verschwindet IMMER, egal was mit der Lottie ist.
  React.useEffect(() => {
    if (phase !== 'boot') return;
    const t = window.setTimeout(finish, HARD_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [phase, finish]);

  if (phase === 'gone') return null;

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center
                 transition-opacity duration-300 will-change-[opacity]"
      style={{ opacity: phase === 'fading' ? 0 : 1, pointerEvents: 'none' }}
    >
      <Image
        src="/subm8-logo.png"
        alt="Subm8 Logo"
        width={240}
        height={72}
        priority
        sizes="220px"
        className="w-[220px] h-auto"
      />
      <div className="mt-6 w-[260px] sm:w-[320px] h-[180px] sm:h-[220px]">
        <Lottie
          animationData={heartThrow}
          loop={false}
          autoplay
          onComplete={finish}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
}