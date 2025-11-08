//src/components/VideoPlayer.tsx
'use client';

import * as React from 'react';

type Props = {
  src: string;
  poster?: string;
  className?: string;
  autoPlay?: boolean; // now respected
  muted?: boolean;    // initial fallback if nothing in LS
  loop?: boolean;
  onActivate?: () => void;
  showScrubber?: boolean;
  rightTag?: string;
  clickToToggle?: boolean;
};

const LS_MUTED_KEY = 'vp:muted';
const EVT_MUTED = 'video:mutedChange';
const EVT_PLAYING = 'video:playing';
const EVT_WIN = 'video:winner';

/* ---------- Types & window augmentation ---------- */
type RatioEntry = { ratio: number; centerDist: number; ts: number };
type VpState = {
  ratios: Map<string, RatioEntry>;
  winner: string | null;
  pickWinner: () => void;
};

declare global {
  interface Window {
    __vpState?: VpState;
  }
}

function getVpState(): VpState {
  if (!window.__vpState) {
    window.__vpState = {
      ratios: new Map<string, RatioEntry>(),
      winner: null,
      pickWinner() {
        let best: string | null = null;
        let bestRatio = 0;
        let bestDist = Infinity;
        this.ratios.forEach((val: RatioEntry, id: string) => {
          if (
            val.ratio > bestRatio + 1e-6 ||
            (Math.abs(val.ratio - bestRatio) < 1e-6 && val.centerDist < bestDist)
          ) {
            best = id;
            bestRatio = val.ratio;
            bestDist = val.centerDist;
          }
        });
        if (best !== this.winner) {
          this.winner = best;
          window.dispatchEvent(new CustomEvent(EVT_WIN, { detail: { id: best } }));
        }
      },
    };
  }
  return window.__vpState!;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

let USER_ACTIVATED = false;
function ensureUserActivationOnce() {
  if (USER_ACTIVATED) return;
  const onAny = () => {
    USER_ACTIVATED = true;
    window.removeEventListener('pointerdown', onAny, true);
    window.dispatchEvent(new Event('user:activated'));
  };
  window.addEventListener('pointerdown', onAny, true);
}

export default function VideoPlayer({
  src,
  poster,
  className,
  autoPlay = true, // default true
  muted,
  loop,
  onActivate,
  showScrubber = false,
  rightTag, 
  clickToToggle = false,
}: Props) {
  ensureUserActivationOnce();

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const idRef = React.useRef<string>(uid());
  

  // read global muted (defaults to true like Reddit)
  const [mutedState, setMutedState] = React.useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(LS_MUTED_KEY);
      if (stored === '1' || stored === 'true') return true;
      if (stored === '0' || stored === 'false') return false;
    } catch {}
    return muted ?? true;
  });

  const [playing, setPlaying] = React.useState(false);
  const [waiting, setWaiting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const mutedRef = React.useRef(mutedState);
  const [duration, setDuration] = React.useState(0);
  const [time, setTime] = React.useState(0);

  const fmt = (s: number) => {
    s = Math.max(0, Math.floor(s));
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${m}:${ss < 10 ? '0' : ''}${ss}`;
  };
  React.useEffect(() => { mutedRef.current = mutedState; }, [mutedState]);

  // sync element with state
  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = mutedState;
  }, [mutedState]);

  // listen for global mute changes from other players
  React.useEffect(() => {
    const onGlobal = (e: Event) => {
      const ce = e as CustomEvent<{ muted: boolean }>;
      if (typeof ce.detail?.muted === 'boolean') setMutedState(ce.detail.muted);
    };
    window.addEventListener(EVT_MUTED, onGlobal as EventListener);
    return () => window.removeEventListener(EVT_MUTED, onGlobal as EventListener);
  }, []);

  // === Autoplay with global "winner" ===
  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    v.playsInline = true;
    const id = idRef.current;

    const tryPlay = () => {
      if (document.hidden || !autoPlay) return;
      if (USER_ACTIVATED) {
        v.muted = mutedRef.current;     // <- aus Ref statt aus State
        void v.play().catch(() => {});
      } else {
        v.muted = true;
        void v.play().catch(() => {});
      }
    };

    const pause = () => v.pause();

    const update = (entry: IntersectionObserverEntry) => {
      const r = entry.boundingClientRect;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const centerY = vh * 0.5;
      const centerDist = Math.max(
        0,
        Math.min(Math.abs(r.top - centerY), Math.abs(r.bottom - centerY))
      );
      const ratio = entry.intersectionRatio;

      const vp = getVpState();
      vp.ratios.set(id, { ratio, centerDist, ts: performance.now() });
      vp.pickWinner();
    };

    const thresholds = Array.from({ length: 21 }, (_, i) => i / 20);
    const io = new IntersectionObserver(([e]) => update(e), { threshold: thresholds });
    io.observe(v);

    const onWinner = (e: Event) => {
      const winId = (e as CustomEvent<{ id: string | null }>).detail.id;
      if (winId === id) tryPlay();
      else pause();
    };
    window.addEventListener(EVT_WIN, onWinner as EventListener);

    // First check
    requestAnimationFrame(() => {
      const rect = v.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const ix = Math.max(0, Math.min(rect.right, vw) - Math.max(rect.left, 0));
      const iy = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
      const interArea = ix * iy;
      const area = Math.max(1, rect.width * rect.height);
      const fakeEntry = {
        boundingClientRect: rect,
        intersectionRatio: Math.max(0, Math.min(1, interArea / area)),
      } as Pick<IntersectionObserverEntry, 'boundingClientRect' | 'intersectionRatio'> as IntersectionObserverEntry;
      update(fakeEntry);
    });

    const onVis = () => {
      if (document.hidden) v.pause();
      else getVpState().pickWinner();
    };
    document.addEventListener('visibilitychange', onVis);

    const onActivated = () => {
      const vp = getVpState();
      if (vp.winner === id) {
        v.muted = mutedState;
        void v.play().catch(() => {});
      }
    };
    window.addEventListener('user:activated', onActivated);

    return () => {
      // Cleanup nur beim Unmount, da der Effect nicht mehr wegen mutedState rerendert
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('user:activated', onActivated);
      window.removeEventListener(EVT_WIN, onWinner as EventListener);
      const vp = getVpState();
      vp.ratios.delete(id);
      vp.pickWinner();
    };
  }, [autoPlay, mutedState]);

  // === Optional: keep legacy "pause others on playing" (harmless with arbiter) ===
  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onAnyPlaying = (e: Event) => {
      const el = (e as CustomEvent<{ el: HTMLVideoElement }>).detail?.el;
      if (el && el !== v && !v.paused) v.pause();
    };
    window.addEventListener(EVT_PLAYING, onAnyPlaying as EventListener);
    return () => window.removeEventListener(EVT_PLAYING, onAnyPlaying as EventListener);
  }, []);

  const announcePlaying = () => {
    try {
      window.dispatchEvent(new CustomEvent(EVT_PLAYING, { detail: { el: videoRef.current! } }));
    } catch {}
  };

  const onContainerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;

    if (clickToToggle) {
      // Medien-Seite: per Klick Play/Pause
      if (v.paused) { void v.play(); } else { v.pause(); }
      return;
    }

    // Feed/Detail: altes Verhalten (Klick öffnet Media-Page, wenn schon spielend)
    if (!v.paused) {
      onActivate?.();
    } else {
      void v.play();
    }
  };

  const toggleMute = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const next = !mutedState;
    setMutedState(next);
    try {
      localStorage.setItem(LS_MUTED_KEY, next ? '1' : '0');
      window.dispatchEvent(new CustomEvent(EVT_MUTED, { detail: { muted: next } }));
    } catch {}

    const v = videoRef.current;
    if (!v) return;

    const vp = getVpState();
    // wenn dieses Video aktuell Gewinner ist, Tonzustand setzen und weiter spielen
    if (vp.winner === idRef.current) {
      v.muted = next;
      if (v.paused) {
        // Click auf den Button ist User-Geste → Play mit Ton erlaubt
        void v.play().catch(() => {});
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-xl bg-black/70 border border-white/10"
      role="region"
      aria-label="Video"
      onClick={onContainerClick}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className={`block w-full h-auto object-contain select-none ${className ?? ''}`}
        playsInline
        preload="metadata"
        loop={loop}
        muted={mutedState}
        autoPlay={false}
        controls={false}
        onPlaying={() => {
          setWaiting(false);
          setPlaying(true);
          announcePlaying();
        }}
        onPause={() => setPlaying(false)}
        onWaiting={() => setWaiting(true)}
        onLoadedData={() => setWaiting(false)}
        onLoadedMetadata={() => {
          const v = videoRef.current;
          if (v) setDuration(v.duration || 0);
        }}
        onTimeUpdate={() => {
          const v = videoRef.current;
          if (v) setTime(v.currentTime || 0);
        }}
        onError={() => setError('')}
        onDoubleClick={(e) => {
          e.stopPropagation();
          const root = (e.currentTarget.parentElement as HTMLElement) || document.documentElement;
          if (document.fullscreenElement) void document.exitFullscreen();
          else void root.requestFullscreen().catch(() => {});
        }}
      />

      {/* Play glyph */}
      {!playing && !error && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="rounded-full bg-black/55 backdrop-blur px-5 py-4 border border-white/20">
            <svg viewBox="0 0 24 24" width="42" height="42" fill="white" aria-hidden>
              <path d="M8 5v14l11-7-11-7z" />
            </svg>
          </div>
        </div>
      )}

      {/* Spinner */}
      {waiting && !error && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="size-7 rounded-full border-2 border-white/40 border-t-transparent animate-spin" />
        </div>
      )}

      {/* Mute toggle */}
      <button
        type="button"
        aria-label={mutedState ? 'Unmute' : 'Mute'}
        title={mutedState ? 'Unmute' : 'Mute'}
        onClick={toggleMute}
        className="
          absolute left-2 bottom-2 z-10 grid place-items-center
          h-8 w-8 rounded-full bg-black/65 border border-white/20 text-white
          hover:bg-black/75 focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/40
        "
      >
        {mutedState ? (
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M5 10v4h4l5 5V5l-5 5H5z" />
            <line x1="16.5" y1="8.5" x2="21.5" y2="13.5" />
            <line x1="21.5" y1="8.5" x2="16.5" y2="13.5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
            <path d="M5 10v4h4l5 5V5l-5 5H5z" />
            <path d="M16 7a5 5 0 0 1 0 10V7z" />
          </svg>
        )}
      </button>
      {showScrubber && (
      <div
        className="
          absolute left-12 right-2 bottom-2 z-10
          pr-[env(safe-area-inset-right,0px)]
        "
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 rounded-lg bg-black/60 backdrop-blur border border-white/15 px-2 py-1">

          {/* Progress (schmaler) */}
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(time, duration || 0)}
            onChange={(e) => {
              const v = videoRef.current;
              if (!v) return;
              const t = Number(e.currentTarget.value);
              v.currentTime = t;
              setTime(t);
            }}
            className="flex-1 h-1 appearance-none bg-white/25 rounded-full accent-white"
          />

          {/* Zeit (kompakt) */}
          <div className="tabular-nums text-[11px] text-white/85 min-w-[64px] text-right">
            {fmt(time)} / {fmt(duration)}
          </div>

          {/* Optionaler Tag rechts */}
          {rightTag ? (
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-white/15 border border-white/20">
              {rightTag}
            </span>
          ) : null}
        </div>
      </div>
    )}
    </div>
  );
}
