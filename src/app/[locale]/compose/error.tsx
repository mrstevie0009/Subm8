// src/app/[locale]/compose/error.tsx
'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ComposeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Für Debugging/Monitoring
    console.error('Compose error:', error);
  }, [error]);

  // Optional: Bekanntere Fehlermeldungen hübscher darstellen
  const message =
    error?.message?.includes('Too many') || error?.message?.includes('Zu viele')
      ? 'Rate-Limit erreicht. Bitte kurz warten und erneut versuchen.'
      : error?.message?.includes('Dateityp') || error?.message?.includes('nicht erlaubt')
      ? 'Dateityp nicht erlaubt. Bitte JPG, PNG, WebP oder GIF verwenden.'
      : error?.message?.includes('größer') || error?.message?.toLowerCase().includes('size')
      ? 'Die Datei ist zu groß. Bitte eine kleinere Datei wählen.'
      : error?.message || 'Beim Erstellen des Posts ist etwas schiefgelaufen.';

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
        <h2 className="text-base font-semibold">Posten fehlgeschlagen 😢</h2>
        <p className="mt-1 text-sm">{message}</p>

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => reset()}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
          >
            Erneut versuchen
          </button>
          <Link
            href="/"
            className="rounded-md px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
          >
            Zurück zum Feed
          </Link>
        </div>

        {/* Für Support/Debug hilfreich */}
        {process.env.NODE_ENV !== 'production' && error?.digest && (
          <p className="mt-3 text-xs text-red-600/80">Fehler-ID: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
