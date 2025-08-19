// src/app/[locale]/error.tsx
'use client';

import { useEffect } from 'react';

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Locale segment error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md w-full p-6 rounded-xl shadow bg-white border border-gray-200 text-center">
        <h2 className="text-lg font-semibold">Unerwarteter Fehler 😬</h2>
        <p className="text-sm mt-2 text-gray-600">
          {error.message || 'Etwas ist schiefgelaufen.'}
        </p>
        <button
          onClick={() => reset()}
          className="mt-4 px-4 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-700"
        >
          Seite neu laden
        </button>
      </div>
    </div>
  );
}
