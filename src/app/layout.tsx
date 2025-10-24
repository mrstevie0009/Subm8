// src/app/layout.tsx
import './globals.css';

export const metadata = {
  title: 'Subm8',
  description: '...',
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
