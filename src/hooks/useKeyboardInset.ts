'use client';
import * as React from 'react';

/**
 * Setzt documentElement CSS-Var --kb auf die Keyboard-Höhe (px).
 * Funktioniert mit iOS/Android (VisualViewport). Fallback: 0.
 */
export function useKeyboardInset() {
  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) {
      document.documentElement.style.setProperty('--kb', '0px');
      return;
    }

    const update = () => {
      // Keyboard-Höhe ~ (LayoutViewport-H) - (VisualViewport-H) - (offsetTop)
      const h = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--kb', `${Math.round(h)}px`);
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('orientationchange', update);

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
}
