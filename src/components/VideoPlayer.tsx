'use client';

import * as React from 'react';

type Props = {
  src: string;
  className?: string;
  poster?: string;
  autoPlay?: boolean;
  muted?: boolean;
};

export default function VideoPlayer({ src, className, poster, autoPlay, muted }: Props) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = React.useState<boolean>(false);
  const [mutedState, setMuted] = React.useState<boolean>(!!muted);
  const [progress, setProgress] = React.useState<number>(0);
  const [duration, setDuration] = React.useState<number>(0);
  const [volume, setVolume] = React.useState<number>(muted ? 0 : 1);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted && v.volume === 0) {
      v.volume = 0.6;
      setVolume(0.6);
    }
  };

  const onTime = () => {
    const v = videoRef.current;
    if (!v || !v.duration || Number.isNaN(v.duration)) return;
    setDuration(v.duration);
    setProgress((v.currentTime / v.duration) * 100);
    setPlaying(!v.paused && !v.ended);
  };

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const p = Number(e.currentTarget.value);
    v.currentTime = (p / 100) * duration;
    setProgress(p);
  };

  const onVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const val = Number(e.currentTarget.value);
    v.volume = val;
    v.muted = val === 0;
    setMuted(v.muted);
    setVolume(val);
  };

  const goFullscreen = async () => {
    const v = videoRef.current;
    if (!v) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await v.requestFullscreen();
    }
  };

  const goPiP = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if ('pictureInPictureElement' in document && (document as Document & { pictureInPictureElement?: Element | null }).pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if ('requestPictureInPicture' in v) {
        await (v as HTMLVideoElement & { requestPictureInPicture: () => Promise<PictureInPictureWindow> }).requestPictureInPicture();
      }
    } catch {
      /* noop */
    }
  };

  const fmt = (s: number) => {
    if (!Number.isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${r.toString().padStart(2, '0')}`;
    };

  return (
    <div className={`relative group bg-black ${className ?? ''}`}>
      <video
        ref={videoRef}
        src={src}
        className="block w-full h-auto"
        poster={poster}
        playsInline
        muted={mutedState}
        onClick={togglePlay}
        onTimeUpdate={onTime}
        onLoadedMetadata={onTime}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        autoPlay={autoPlay}
        controls={false}
      />

      {!playing && (
        <button
          type="button"
          aria-label="Play"
          onClick={togglePlay}
          className="absolute inset-0 grid place-items-center text-white/95"
        >
          <div className="rounded-full bg-black/50 backdrop-blur px-4 py-3 border border-white/20">
            <svg viewBox="0 0 24 24" width="42" height="42" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7-11-7z" />
            </svg>
          </div>
        </button>
      )}

      {/* Controls */}
      <div
        className="absolute left-0 right-0 bottom-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,.55), rgba(0,0,0,0))' }}
      >
        <input
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={progress}
          onChange={onSeek}
          className="w-full accent-[var(--purple)]"
        />

        <div className="mt-1 flex items-center justify-between gap-2 text-white">
          <div className="flex items-center gap-2">
            <button type="button" onClick={togglePlay} className="px-2 py-1 hover:bg-white/10 rounded">
              {playing ? (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7-11-7z" /></svg>
              )}
            </button>

            <button type="button" onClick={toggleMute} className="px-2 py-1 hover:bg-white/10 rounded">
              {mutedState || volume === 0 ? (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M5 10v4h4l5 5V5l-5 5H5zM17.59 7.41 16.17 8.83 18.34 11l-2.17 2.17 1.41 1.41L21.16 11l-3.57-3.59z"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M5 10v4h4l5 5V5l-5 5H5z"/><path d="M16 7a5 5 0 0 1 0 10V7z"/></svg>
              )}
            </button>

            <input type="range" min={0} max={1} step={0.02} value={volume} onChange={onVolume} className="w-24 accent-[var(--purple)]" />

            <span className="text-xs opacity-80 tabular-nums">
              {fmt(videoRef.current?.currentTime ?? 0)} / {fmt(duration)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button type="button" onClick={goPiP} className="px-2 py-1 hover:bg-white/10 rounded" title="Picture in Picture">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5h-8a2 2 0 0 0-2 2v6H5a2 2 0 0 1-2-2V5z"/><rect x="12" y="10" width="9" height="7" rx="1"/></svg>
            </button>
            <button type="button" onClick={goFullscreen} className="px-2 py-1 hover:bg-white/10 rounded" title="Fullscreen">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M4 4h6v2H6v4H4V4Zm10 0h6v6h-2V6h-4V4ZM4 14h2v4h4v2H4v-6Zm14 0h2v6h-6v-2h4v-4Z"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
