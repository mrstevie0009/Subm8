import * as React from 'react';

type LegalArticleProps = {
  title: string;
  subtitle?: string;
  updated?: string; // "30.08.2025"
  children: React.ReactNode;
};

export function LegalArticle({ title, subtitle, updated, children }: LegalArticleProps) {
  return (
    <article className="rounded-xl border border-white/10 bg-white/[0.02] shadow-lg shadow-black/10 overflow-hidden">
      <header className="border-b border-white/10">
        <div className="h-1 w-full bg-gradient-to-r from-white/20 via-white/10 to-transparent" />
        <div className="px-5 py-4">
          <h1 className="text-xl font-semibold">{title}</h1>
          {subtitle && <p className="text-sm text-white/70 mt-1">{subtitle}</p>}
          {updated && (
            <p className="text-xs text-white/50 mt-1">
              Zuletzt aktualisiert: <span className="tabular-nums">{updated}</span>
            </p>
          )}
        </div>
      </header>

      <div className="p-5">
        <div className="prose prose-invert max-w-none prose-headings:scroll-mt-24
                        prose-p:leading-relaxed prose-li:marker:text-white/50
                        prose-hr:border-white/10 prose-a:underline-offset-4
                        prose-a:text-white hover:prose-a:text-white/90">
          {children}
        </div>
      </div>
    </article>
  );
}

type CalloutProps = {
  tone?: 'info' | 'warn' | 'danger';
  title?: string;
  children: React.ReactNode;
};

export function Callout({ tone = 'info', title, children }: CalloutProps) {
  const tones: Record<NonNullable<CalloutProps['tone']>, string> = {
    info: 'border-blue-400/30 bg-blue-400/5',
    warn: 'border-amber-400/30 bg-amber-400/5',
    danger: 'border-red-400/30 bg-red-400/5',
  };
  return (
    <div className={`not-prose rounded-lg border px-4 py-3 ${tones[tone]}`}>
      {title && <div className="text-sm font-medium mb-1">{title}</div>}
      <div className="text-sm text-white/80">{children}</div>
    </div>
  );
}
