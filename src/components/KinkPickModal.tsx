// src/components/KinkPickerModal.tsx
'use client';
import * as React from 'react';
import { createPortal } from 'react-dom';


export default function KinkPickerModal({
  open,
  onClose,
  options,
  value,
  onChange,
  max = 10,
  title = 'Select kinks',
  searchPlaceholder = 'Search kinks…',
  doneLabel = 'Done',
  clearLabel = 'Clear',
  selectedLabel = 'Selected',
  noResultsLabel = 'No results.',
  maxReachedLabel,
}: {
  open: boolean;
  onClose: () => void;
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  title?: string;
  searchPlaceholder?: string;
  doneLabel?: string;
  clearLabel?: string;
  selectedLabel?: string;
  noResultsLabel?: string;
  maxReachedLabel?: string; // optional custom text
}) {
  const [q, setQ] = React.useState('');

  React.useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const selected = React.useMemo(() => new Set(value), [value]);

  const filtered = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return options;
    return options.filter((k) => k.toLowerCase().includes(qq));
  }, [q, options]);

  const toggle = (k: string) => {
    const has = selected.has(k);
    if (has) {
      onChange(value.filter((x) => x !== k));
      return;
    }
    if (value.length >= max) return;
    onChange([...value, k]);
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483605] bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.currentTarget === e.target && onClose()}
      style={{ touchAction: 'pan-y' }} // ✅ mobile scroll gestures
    >
      <div
        className="absolute left-1/2 top-1/2 w-full max-w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/12 bg-[#111114] shadow-2xl overflow-hidden flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxHeight: 'calc(100dvh - 32px)' }} // ✅ modal never exceeds viewport
      >
        {/* Header (fixed) */}
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
          <div>
            <div className="text-[18px] font-semibold">{title}</div>
            <div className="text-sm text-white/60">{value.length}/{max} selected</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange([])}
              className="px-3 h-9 rounded-full border border-white/15 hover:bg-white/5"
              disabled={value.length === 0}
            >
              {clearLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 h-9 rounded-full bg-[var(--purple)] text-white hover:opacity-95"
            >
              {doneLabel}
            </button>
          </div>
        </div>

        {/* ✅ Scroll Area (everything below header scrolls) */}
        <div
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* Search */}
          <div className="p-4 border-b border-white/10">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-2xl bg-white/[.06] border border-white/10 px-4 py-3 outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
            />
            {value.length >= max && (
              <div className="mt-2 text-sm text-yellow-200">
                {maxReachedLabel ?? `Max ${max} reached. Remove one to add another.`}
              </div>
            )}
          </div>

          {/* Selected */}
          {value.length > 0 && (
            <div className="px-4 pt-4">
              <div className="text-xs text-white/60 mb-2">{selectedLabel}</div>
              <div className="flex flex-wrap gap-2">
                {value.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggle(k)}
                    className="text-[12px] px-2 py-1 rounded-full border hover:opacity-95"
                    style={{
                      color: 'var(--purple)',
                      background: 'rgba(139,92,246,0.12)',
                      borderColor: 'rgba(139,92,246,0.25)',
                    }}
                    title="Remove"
                  >
                    {k} <span className="opacity-70">×</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Grid */}
          <div className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {filtered.map((k) => {
                const isOn = selected.has(k);
                const disabled = !isOn && value.length >= max;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => !disabled && toggle(k)}
                    disabled={disabled}
                    className={`rounded-2xl border px-3 py-2 text-left text-[13px] transition
                      ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/[.04]'}
                    `}
                    style={{
                      borderColor: isOn ? 'rgba(139,92,246,0.35)' : 'rgba(255,255,255,0.12)',
                      background: isOn ? 'rgba(139,92,246,0.14)' : 'rgba(255,255,255,0.03)',
                      color: isOn ? 'var(--purple)' : 'rgba(255,255,255,0.9)',
                    }}
                  >
                    {k}
                  </button>
                );
              })}
            </div>

            {filtered.length === 0 && (
              <div className="text-sm text-white/60">{noResultsLabel}</div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
