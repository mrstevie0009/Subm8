'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';

const Lottie = dynamic(() => import('lottie-react'), {
  ssr: false,
});

import heartThrow from '@/lotties/heart-throw-Lottie.json';

export default function BootSplashLottie() {
  const [host, setHost] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    setHost(document.getElementById('boot-splash-lottie'));
  }, []);

  const signalDone = React.useCallback(() => {
    window.dispatchEvent(new Event('boot:splash-done'));
  }, []);

  if (!host) return null;

  return createPortal(
    <Lottie
      animationData={heartThrow}
      loop={false}
      autoplay
      onComplete={signalDone}
      style={{ width: '100%', height: '100%' }}
    />,
    host
  );
}