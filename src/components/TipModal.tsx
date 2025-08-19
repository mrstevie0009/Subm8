'use client';
import * as React from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (amountCents: number, methodId: string) => void;
  receipient: { name: string; role: 'domme' | 'submissive'; avatarUrl?: string };
};

const AVATAR_PH = '/images/avatar-placeholder.png';

export default function TipModal({ open, onClose, onConfirm, receipient }: Props) {
  const [amount, setAmount] = React.useState('');
  const [method, setMethod] = React.useState('card_5912');

  const methods = React.useMemo(
    () => [
      { id: 'card_5912', label: 'visa  ****5912' },
      { id: 'card_7320', label: 'mc    ****7320' },
    ],
    []
  );

  const minUSD = 5;
  const num = Number(amount);
  const valid = Number.isFinite(num) && num >= minUSD;

  React.useEffect(() => {
    if (open) {
      setAmount('');
      setMethod('card_5912');
    }
  }, [open]);

  const handleSave = React.useCallback(() => {
    if (!valid) return;
    onConfirm(Math.round(Number(amount) * 100), method);
    onClose();
  }, [valid, amount, method, onConfirm, onClose]);

  // ESC / ENTER
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && valid) handleSave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, valid, handleSave, onClose]);

  // Backdrop erst nach 1 Frame aktiv -> Öffnen-Klick schließt nicht wieder
  const [armed, setArmed] = React.useState(false);
  React.useLayoutEffect(() => {
    if (!open) return;
    setArmed(false);
    const id = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  // SSR-safe
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!open || !mounted) return null;

  // Inline-Styles (robust gegen Tailwind/Stacking-Kontexte)
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 2147483647, // super hoch
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
  };

  const cardStyle: React.CSSProperties = {
    position: 'relative',
    width: 'min(92vw, 520px)',
    borderRadius: 24,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.10)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    background: '#2A2140',
    color: 'white',
  };

  const headerStyle: React.CSSProperties = {
    background: '#372753',
    padding: '16px 16px 12px',
  };

  const pillBg = '#E5E7EB';
  const darkText = '#2B2D31';

  const modal = (
    <div
      style={overlayStyle}
      // Nur Klicks DIREKT aufs Overlay (außerhalb des Dialogs) schließen – aber erst wenn armed
      onMouseDown={(e) => {
        if (!armed) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        style={cardStyle}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                position: 'relative',
                width: 44,
                height: 44,
                borderRadius: '9999px',
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.2)',
              }}
            >
              <Image
                src={receipient.avatarUrl || AVATAR_PH}
                alt=""
                fill
                className="object-cover"
                sizes="44px"
              />
            </div>
            <div style={{ lineHeight: 1.1 }}>
              <div style={{ fontWeight: 600, fontSize: 18 }}>{receipient.name}</div>
              <div style={{ opacity: 0.75, fontSize: 12 }}>
                {receipient.role === 'domme' ? 'Domina' : 'Sub'}
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, width: '100%', background: 'rgba(255,255,255,.14)' }} />

        {/* Body */}
        <div style={{ padding: 16 }}>
          {/* Amount */}
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 16px',
                height: 48,
                borderRadius: 9999,
                background: pillBg,
              }}
            >
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder="Tip Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  outline: 'none',
                  border: 'none',
                  color: darkText,
                  fontSize: 16,
                }}
              />
            </div>
            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 6 }}>
              Minimum ${minUSD} USD
            </div>
          </div>

          {/* Payment method */}
          <div>
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                height: 48,
                borderRadius: 9999,
                background: pillBg,
              }}
            >
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  outline: 'none',
                  border: 'none',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  paddingRight: 32,
                  color: darkText,
                  fontSize: 16,
                }}
              >
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              {/* Chevron */}
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                style={{ position: 'absolute', right: 12, width: 22, height: 22, color: 'var(--purple)' }}
              >
                <path
                  d="M6 9l6 6 6-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 6 }}>
              Minimum ${minUSD} USD
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--purple)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid}
            onClick={handleSave}
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: valid ? 'white' : '#bdbdbd',
              background: 'transparent',
              border: 'none',
              cursor: valid ? 'pointer' : 'default',
              opacity: valid ? 1 : 0.4,
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
