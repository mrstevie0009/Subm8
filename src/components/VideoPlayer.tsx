'use client';

import * as React from 'react';

type Props = {
  src: string;
  poster?: string;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
};

const LS_VOL_KEY = 'vp:vol';
const LS_MUTED_KEY = 'vp:muted';
const LS_RATE_KEY = 'vp:rate';

export default function VideoPlayer({
  src,
  poster,
  className,
  autoPlay,
  muted,
  loop,
}: Props) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  const [playing, setPlaying] = React.useState(false);
  const [mutedState, setMuted] = React.useState<boolean>(!!muted);
  const [volume, setVolume] = React.useState<number>(muted ? 0 : 1);
  const [duration, setDuration] = React.useState(0);
  const [progressPct, setProgressPct] = React.useState(0);     // played %
  const [bufferPct, setBufferPct] = React.useState(0);         // buffered %
  const [rate, setRate] = React.useState<number>(1);
  const [hoverPct, setHoverPct] = React.useState<number | null>(null);
  const [isWaiting, setIsWaiting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = React.useState(true);
  const [cursorHidden, setCursorHidden] = React.useState(false);

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const hideTimer = React.useRef<number | null>(null);

  // Load persisted settings
  React.useEffect(() => {
    try {
      const v = Number(localStorage.getItem(LS_VOL_KEY));
      if (!Number.isNaN(v) && v >= 0 && v <= 1) setVolume(v);
      const m = localStorage.getItem(LS_MUTED_KEY);
      if (m === '1' || m === 'true') setMuted(true);
      const r = Number(localStorage.getItem(LS_RATE_KEY));
      if (!Number.isNaN(r) && r > 0) setRate(r);
    } catch {}
  }, []);

  // Apply to video element
  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = rate;
    v.volume = volume;
    v.muted = mutedState || volume === 0;
  }, [rate, volume, mutedState]);

  // Persist settings
  React.useEffect(() => {
    try {
      localStorage.setItem(LS_VOL_KEY, String(volume));
      localStorage.setItem(LS_MUTED_KEY, mutedState ? '1' : '0');
      localStorage.setItem(LS_RATE_KEY, String(rate));
    } catch {}
  }, [volume, mutedState, rate]);

  const fmt = (s: number) => {
    if (!Number.isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${r.toString().padStart(2, '0')}`;
  };

  const updateBuffered = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    try {
      const ranges = v.buffered;
      if (ranges.length) {
        const end = ranges.end(ranges.length - 1);
        setBufferPct(Math.min(100, (end / v.duration) * 100));
      }
    } catch {}
  };

  const onTime = () => {
    const v = videoRef.current;
    if (!v || !v.duration || Number.isNaN(v.duration)) return;
    setDuration(v.duration);
    setProgressPct((v.currentTime / v.duration) * 100);
    setPlaying(!v.paused && !v.ended);
    updateBuffered();
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    const next = !v.muted;
    v.muted = next;
    setMuted(next);
    if (!next && v.volume === 0) {
      v.volume = 0.6;
      setVolume(0.6);
    }
  };

  const seekPct = (pct: number) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const clamped = Math.max(0, Math.min(100, pct));
    v.currentTime = (clamped / 100) * duration;
    setProgressPct(clamped);
  };

  const onSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    seekPct(pct);
  };

  const onHoverMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    setHoverPct(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
  };

  const onHoverOut = () => setHoverPct(null);

  const goFullscreen = async () => {
    const root = containerRef.current;
    if (!root) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.requestFullscreen();
    } catch {}
  };

  const goPiP = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if ('requestPictureInPicture' in v) {
        await v.requestPictureInPicture();
      }
    } catch {}
  };

  // Auto-hide controls + cursor when idle
  const poke = React.useCallback(() => {
    setControlsVisible(true);
    setCursorHidden(false);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (playing) {
        setControlsVisible(false);
        setCursorHidden(true);
      }
    }, 1800);
  }, [playing]);

  React.useEffect(() => {
    poke();
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [poke]);

  // Keyboard shortcuts (focus container)
  const onKey: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
    switch (e.key) {
      case ' ':
      case 'k':
        e.preventDefault(); togglePlay(); break;
      case 'm':
        toggleMute(); break;
      case 'f':
        void goFullscreen(); break;
      case 'ArrowRight':
        seekPct(progressPct + (e.shiftKey ? 10 : 5)); break;
      case 'ArrowLeft':
        seekPct(progressPct - (e.shiftKey ? 10 : 5)); break;
      case 'ArrowUp': {
        const nv = Math.min(1, volume + 0.05);
        setVolume(nv); setMuted(nv === 0); break;
      }
      case 'ArrowDown': {
        const nv = Math.max(0, volume - 0.05);
        setVolume(nv); setMuted(nv === 0); break;
      }
      case '>':
      case '.':
        setRate((r) => Math.min(2, Math.round((r + 0.25) * 4) / 4)); break;
      case '<':
      case ',':
        setRate((r) => Math.max(0.25, Math.round((r - 0.25) * 4) / 4)); break;
    }
    poke();
  };

  // Derived tooltip time
  const hoverTime = React.useMemo(() => {
    if (hoverPct == null || !duration) return null;
    const secs = Math.max(0, Math.min(duration, (hoverPct / 100) * duration));
    return fmt(secs);
  }, [hoverPct, duration]);

  return (
    <div
      ref={containerRef}
      className={`relative rounded-xl overflow-hidden bg-black/60 border border-white/10 shadow-lg ${className ?? ''}`}
      tabIndex={0}
      onKeyDown={onKey}
      onPointerMove={poke}
      onMouseMove={poke}
      onClick={() => {
        // Toggle play on background click (but not when clicking a control)
        togglePlay();
      }}
      style={{ cursor: cursorHidden ? 'none' : 'auto' }}
      role="region"
      aria-label="Video player"
    >
      {/* Video */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="block w-full h-auto select-none"
        playsInline
        loop={loop}
        muted={mutedState}
        autoPlay={autoPlay}
        controls={false}
        onTimeUpdate={onTime}
        onLoadedMetadata={onTime}
        onProgress={updateBuffered}
        onWaiting={() => setIsWaiting(true)}
        onPlaying={() => setIsWaiting(false)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onError={() => setError('Video konnte nicht geladen werden.')}
        // Doppelklick → Fullscreen
        onDoubleClick={(e) => {
          e.stopPropagation();
          void goFullscreen();
        }}
      />

      {/* Center Play / Spinner / Error */}
      {!playing && !error && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
          className="absolute inset-0 grid place-items-center"
          aria-label="Play"
        >
          <div className="rounded-full bg-black/55 backdrop-blur px-5 py-4 border border-white/20">
            <svg viewBox="0 0 24 24" width="44" height="44" fill="currentColor" className="text-white">
              <path d="M8 5v14l11-7-11-7z" />
            </svg>
          </div>
        </button>
      )}

      {isWaiting && !error && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="size-8 rounded-full border-2 border-white/40 border-t-transparent animate-spin" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-lg bg-black/70 border border-white/15 px-4 py-3 text-sm text-white/90">
            {error}
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div
        className={`absolute inset-x-0 bottom-0 transition-opacity ${
          controlsVisible || !playing ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28"
             style={{ background: 'linear-gradient(to top, rgba(0,0,0,.65), rgba(0,0,0,0))' }} />

        {/* Seek bar */}
        <div
          className="relative z-10 mx-3 mb-2 h-6 group/seek cursor-pointer"  // größere Klickfläche
          onMouseMove={onHoverMove}
          onMouseLeave={onHoverOut}
          onClick={onSeek}
          aria-label="Seek"
          role="slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progressPct)}
        >
          {/* Track (dünn) */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[4px] rounded-full bg-white/20" />

          {/* Buffered (dünn) */}
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-[4px] rounded-full bg-white/35"
            style={{ width: `${bufferPct}%` }}
          />

          {/* Played (dünn, in Purple) */}
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-[4px] rounded-full bg-[var(--purple)]"
            style={{ width: `${progressPct}%` }}
          />

          {/* Thumb (zentriert im Balken) */}
          <div
            className="absolute top-1/2 -translate-y-1/2 size-3 rounded-full bg-white shadow ring-2 ring-[var(--purple)]
                      opacity-0 group-hover/seek:opacity-100 transition-opacity"
            style={{ left: `calc(${progressPct}% - 6px)` }} // 6px = Hälfte von size-3 (12px)
            aria-hidden
          />

          {/* Hover time tooltip */}
          {hoverPct != null && (
            <div
              className="absolute -top-7 translate-x-[-50%] rounded-md px-2 py-0.5 text-[11px]
                        bg-black/80 border border-white/15 pointer-events-none"
              style={{ left: `${hoverPct}%` }}
            >
              {hoverTime}
            </div>
          )}
        </div>

        {/* Control row */}
        <div className="relative z-10 mx-2 mb-2 flex items-center justify-between gap-2 text-white">
          <div className="flex items-center gap-1.5">
            {/* Play/Pause */}
            <IconButton
              title={playing ? 'Pause' : 'Play'}
              onClick={togglePlay}
            >
              {playing ? (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7-11-7z" /></svg>
              )}
            </IconButton>

            {/* Mute */}
            <IconButton title={mutedState || volume === 0 ? 'Unmute' : 'Mute'} onClick={toggleMute}>
              {mutedState || volume === 0 ? (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M5 10v4h4l5 5V5l-5 5H5zM17.59 7.41 16.17 8.83 18.34 11l-2.17 2.17 1.41 1.41L21.16 11l-3.57-3.59z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M5 10v4h4l5 5V5l-5 5H5z"/><path d="M16 7a5 5 0 0 1 0 10V7z"/>
                </svg>
              )}
            </IconButton>

            {/* Volume slider */}
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={volume}
              onChange={(e) => {
                const val = Number(e.currentTarget.value);
                setVolume(val);
                setMuted(val === 0);
              }}
              className="w-24 accent-[var(--purple)]"
              aria-label="Volume"
            />

            {/* Time */}
            <span className="ml-1 text-[12px] opacity-90 tabular-nums">
              {fmt(videoRef.current?.currentTime ?? 0)} / {fmt(duration)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Playback rate menu */}
            <div className="relative group/rate">
              <button
                type="button"
                className="px-2 h-8 rounded-md bg-white/10 hover:bg-white/15 text-[12px]"
                title="Wiedergabegeschwindigkeit"
              >
                {rate.toFixed(2).replace(/\.00$/, '')}x
              </button>
              <div className="absolute right-0 bottom-9 hidden group-hover/rate:block bg-black/85 border border-white/15 rounded-md p-1 backdrop-blur">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRate(r)}
                    className={`block w-full text-left px-3 py-1 rounded hover:bg-white/10 text-[12px] ${r === rate ? 'text-[var(--purple)]' : 'text-white'}`}
                  >
                    {r}x
                  </button>
                ))}
              </div>
            </div>

            {/* PiP */}
            <IconButton title="Picture in Picture" onClick={goPiP}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5h-8a2 2 0 0 0-2 2v6H5a2 2 0 0 1-2-2V5z"/>
                <rect x="12" y="10" width="9" height="7" rx="1"/>
              </svg>
            </IconButton>

            {/* Fullscreen */}
            <IconButton title="Fullscreen" onClick={goFullscreen}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M4 4h6v2H6v4H4V4Zm10 0h6v6h-2V6h-4V4ZM4 14h2v4h4v2H4v-6Zm14 0h2v6h-6v-2h4v-4Z"/>
              </svg>
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function IconButton({
  onClick,
  title,
  children,
}: {
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="inline-grid place-items-center h-8 w-8 rounded-md hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
    >
      {children}
    </button>
  );
}
