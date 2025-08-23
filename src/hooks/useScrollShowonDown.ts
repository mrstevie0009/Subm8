'use client';
import * as React from 'react';

type Options = {
  /** Ab welcher Delta (px) reagiert wird */
  threshold?: number;
  /** Bis zu diesem Scrollwert ist BottomNav immer sichtbar */
  topAlwaysShow?: number;
};

/** Sichtbar beim Runter-Scrollen, verstecken beim Rauf-Scrollen. Oben immer sichtbar. */
export function useScrollShowOnDown({ threshold = 6, topAlwaysShow = 10 }: Options = {}) {
  const [visible, setVisible] = React.useState(true);
  const lastY = React.useRef(0);
  const ticking = React.useRef(false);

  React.useEffect(() => {
    lastY.current = window.scrollY || 0;

    function onScroll() {
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      const dy = y - lastY.current;

      if (!ticking.current) {
        ticking.current = true;
        requestAnimationFrame(() => {
          if (y <= topAlwaysShow) {
            setVisible(true);               // ganz oben: sichtbar
          } else if (dy > threshold) {
            setVisible(true);               // runter: einblenden
          } else if (dy < -threshold) {
            setVisible(false);              // rauf: ausblenden
          }
          lastY.current = y;
          ticking.current = false;
        });
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold, topAlwaysShow]);

  return visible;
}
