'use client';
import * as React from 'react';

type Options = {
  /** px Änderung, ab der reagiert wird */
  threshold?: number;
  /** bis zu diesem Scrollwert bleibt der Header immer sichtbar */
  topAlwaysShow?: number;
};

export function useScrollHide({ threshold = 6, topAlwaysShow = 10 }: Options = {}) {
  const [hidden, setHidden] = React.useState(false);
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
            setHidden(false);            // ganz oben: immer sichtbar
          } else if (dy > threshold) {
            setHidden(true);             // deutlich nach unten → verstecken
          } else if (dy < -threshold) {
            setHidden(false);            // deutlich nach oben → zeigen
          }
          lastY.current = y;
          ticking.current = false;
        });
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold, topAlwaysShow]);

  return hidden;
}
