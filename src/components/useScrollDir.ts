'use client';
import {useEffect, useRef, useState} from 'react';

export function useScrollDir(threshold = 6) {
  const [dir, setDir] = useState<'up'|'down'>('up');
  const lastY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const d = y > lastY.current + threshold ? 'down' : y < lastY.current - threshold ? 'up' : dir;
      if (d !== dir) setDir(d);
      lastY.current = y;
    };
    window.addEventListener('scroll', onScroll, {passive: true});
    return () => window.removeEventListener('scroll', onScroll);
  }, [dir, threshold]);

  return dir;
}
