// src/app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Subm8',
  description: 'Subm8 – A dedicated social space for Findommes and Subs to express themselves, interact, and grow their community.',

  metadataBase: new URL('https://subm8.com'),

  openGraph: {
    title: 'Subm8',
    description: 'Subm8 – A dedicated social space for Findommes and Subs to express themselves, interact, and grow their community.',
    url: 'https://subm8.com',
    siteName: 'Subm8',
    type: 'website',
    images: [
      {
        url: '/og-image.png',         // später gern auf /og-image.png ändern
        width: 500,
        height: 500,
        alt: 'Subm8 Logo',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: 'Subm8',
    description: 'Subm8 – A dedicated social space for Findommes and Subs to express themselves, interact, and grow their community.',
    images: ['/icon.png'],
  },

  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white min-h-[100svh]">
        {children}
      </body>
    </html>
  );
}
