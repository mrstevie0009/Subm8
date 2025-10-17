// src/app/layout.tsx
import './globals.css'; // falls du globale Styles hast

export const metadata = {
  title: 'Subm8',
  description: '...',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
