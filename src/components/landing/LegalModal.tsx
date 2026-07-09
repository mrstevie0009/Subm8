'use client';

import * as React from 'react';
import { useTranslations, useLocale } from 'next-intl';

export type LegalTab = 'terms' | 'privacy' | 'imprint' | 'age';

/**
 * Wiederverwendbares Rechtstexte-Popup mit vier Tabs
 * (Terms, Privacy, Imprint, Age Verification).
 * Nutzt dieselben Übersetzungen (legal.legal.*) wie die Legal-Seite/Signup.
 */
export default function LegalModal({
  open,
  onClose,
  initialTab = 'terms',
}: {
  open: boolean;
  onClose: () => void;
  initialTab?: LegalTab;
}) {
  const locale = useLocale();
  const tTerms = useTranslations('legal.legal.terms');
  const tPrivacy = useTranslations('legal.legal.privacy');
  const tImprint = useTranslations('legal.legal.imprint');
  const tAge = useTranslations('legal.legal.age');
  const tShared = useTranslations('legal.legal.shared');

  const [tab, setTab] = React.useState<LegalTab>(initialTab);
  React.useEffect(() => setTab(initialTab), [initialTab, open]);

  const updatedStr = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date());

  if (!open) return null;

  const tabs: { id: LegalTab; label: string }[] = [
    { id: 'terms', label: tTerms('title') },
    { id: 'privacy', label: tPrivacy('title') },
    { id: 'imprint', label: tImprint('title') },
    { id: 'age', label: tAge('title') },
  ];
  const activeLabel = tabs.find((x) => x.id === tab)?.label ?? '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={activeLabel}
      className="fixed inset-0 z-[100] grid place-items-center p-4"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl rounded-2xl bg-[#101014] ring-1 ring-white/15 shadow-[0_8px_40px_rgba(0,0,0,.5)] overflow-hidden">
        {/* Tab-Leiste: bricht bei Bedarf um (kein horizontales Scrollen) */}
        <div className="flex items-start justify-between gap-3 px-4 sm:px-6 pt-5">
          <div className="flex flex-wrap gap-1.5 rounded-2xl bg-black/30 p-1.5 ring-1 ring-white/10">
            {tabs.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setTab(x.id)}
                className={`px-3.5 py-1.5 text-[13px] sm:text-sm rounded-full transition ${
                  tab === x.id ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white/90'
                }`}
              >
                {x.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-white/70 hover:text-white transition p-2"
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[70svh] overflow-y-auto px-6 pb-6 pt-4">
          {tab === 'terms' && (
            <article className="prose prose-invert prose-sm sm:prose-base max-w-none">
              <h1 className="mt-0">{tTerms('title')}</h1>
              <p className="text-white/70 -mt-3">{tTerms('subtitle')}</p>
              <p className="text-xs text-white/60">{tShared('updated')}: {updatedStr}</p>
              <h3 className="font-bold">{tTerms('sections.scope')}</h3>
              <p>{tTerms('content.p_scope')}</p>
              <h3 className="font-bold">{tTerms('sections.audience')}</h3>
              <ul className="list-disc pl-5"><li>{tTerms('content.audience_li_1')}</li><li>{tTerms('content.audience_li_2')}</li></ul>
              <h3 className="font-bold">{tTerms('sections.roles')}</h3>
              <p>{tTerms('content.p_roles')}</p>
              <ul className="list-disc pl-5"><li>{tTerms('content.roles_li_1')}</li><li>{tTerms('content.roles_li_2')}</li><li>{tTerms('content.roles_li_3')}</li></ul>
              <h3 className="font-bold">{tTerms('sections.tips')}</h3>
              <ul className="list-disc pl-5"><li>{tTerms('content.tips_li_1')}</li><li>{tTerms('content.tips_li_2')}</li><li>{tTerms('content.tips_li_3')}</li><li>{tTerms('content.tips_li_4')}</li><li>{tTerms('content.tips_li_5')}</li></ul>
              <h3 className="font-bold">{tTerms('sections.fees')}</h3>
              <ul className="list-disc pl-5"><li>{tTerms('content.fees_li_1')}</li><li>{tTerms('content.fees_li_2')}</li><li>{tTerms('content.fees_li_3')}</li><li>{tTerms('content.fees_li_4')}</li></ul>
              <h3 className="font-bold">{tTerms('sections.tax')}</h3>
              <ul className="list-disc pl-5"><li>{tTerms('content.tax_li_1')}</li><li>{tTerms('content.tax_li_2')}</li><li>{tTerms('content.tax_li_3')}</li></ul>
              <h3 className="font-bold">{tTerms('sections.termination')}</h3>
              <ul className="list-disc pl-5"><li>{tTerms('content.termination_li_1')}</li><li>{tTerms('content.termination_li_2')}</li></ul>
              <h3 className="font-bold">{tTerms('sections.liability')}</h3>
              <ul className="list-disc pl-5"><li>{tTerms('content.liability_li_1')}</li><li>{tTerms('content.liability_li_2')}</li></ul>
              <h3 className="font-bold">{tTerms('sections.changes')}</h3>
              <p>{tTerms('content.p_changes')}</p>
              <h3 className="font-bold">{tTerms('sections.law')}</h3>
              <p>{tTerms('content.p_law')}</p>
            </article>
          )}

          {tab === 'privacy' && (
            <article className="prose prose-invert prose-sm sm:prose-base max-w-none">
              <h1 className="mt-0">{tPrivacy('title')}</h1>
              <p className="text-white/70 -mt-3">{tPrivacy('subtitle')}</p>
              <p className="text-xs text-white/60">{tShared('updated')}: {updatedStr}</p>
              <h3 className="font-bold">{tPrivacy('sections.controller')}</h3>
              <p>{tPrivacy('content.p_controller')}</p>
              <h3 className="font-bold">{tPrivacy('sections.data')}</h3>
              <ul className="list-disc pl-5"><li>{tPrivacy('content.data_li_1')}</li><li>{tPrivacy('content.data_li_2')}</li><li>{tPrivacy('content.data_li_3')}</li><li>{tPrivacy('content.data_li_4')}</li></ul>
              <h3 className="font-bold">{tPrivacy('sections.purpose')}</h3>
              <ul className="list-disc pl-5"><li>{tPrivacy('content.purpose_li_1')}</li><li>{tPrivacy('content.purpose_li_2')}</li><li>{tPrivacy('content.purpose_li_3')}</li><li>{tPrivacy('content.purpose_li_4')}</li></ul>
              <h3 className="font-bold">{tPrivacy('sections.legal')}</h3>
              <ul className="list-disc pl-5"><li>{tPrivacy('content.legal_li_1')}</li><li>{tPrivacy('content.legal_li_2')}</li><li>{tPrivacy('content.legal_li_3')}</li></ul>
              <h3 className="font-bold">{tPrivacy('sections.sharing')}</h3>
              <ul className="list-disc pl-5"><li>{tPrivacy('content.sharing_li_1')}</li><li>{tPrivacy('content.sharing_li_2')}</li><li>{tPrivacy('content.sharing_li_3')}</li></ul>
              <h3 className="font-bold">{tPrivacy('sections.retention')}</h3>
              <p>{tPrivacy('content.p_retention')}</p>
              <h3 className="font-bold">{tPrivacy('sections.rights')}</h3>
              <ul className="list-disc pl-5"><li>{tPrivacy('content.rights_li_1')}</li><li>{tPrivacy('content.rights_li_2')}</li><li>{tPrivacy('content.rights_li_3')}</li></ul>
              <h3 className="font-bold">{tPrivacy('sections.cookies')}</h3>
              <p>{tPrivacy('content.p_cookies')}</p>
            </article>
          )}

          {tab === 'imprint' && (
            <article className="prose prose-invert prose-sm sm:prose-base max-w-none">
              <h1 className="mt-0">{tImprint('title')}</h1>
              <p className="text-white/70 -mt-3">{tImprint('subtitle')}</p>
              <p>{tImprint('content.line_1')}</p>
              <h3 className="font-bold">{tImprint('content.represented_by_label')}</h3>
              <p>—</p>
              <h3 className="font-bold">{tImprint('content.contact_label')}</h3>
              <p>—</p>
              <h3 className="font-bold">{tImprint('content.vat_label')}</h3>
              <p>—</p>
              <p className="text-sm text-white/60">{tImprint('content.adult_note')}</p>
            </article>
          )}

          {tab === 'age' && (
            <article className="prose prose-invert prose-sm sm:prose-base max-w-none">
              <h1 className="mt-0">{tAge('title')}</h1>
              <p className="text-white/70 -mt-3">{tAge('subtitle')}</p>
              <h3 className="font-bold">{tAge('sections.access')}</h3>
              <p>{tAge('content.p_access')}</p>
              <h3 className="font-bold">{tAge('sections.proof')}</h3>
              <ul className="list-disc pl-5"><li>{tAge('content.proof_li_1')}</li><li>{tAge('content.proof_li_2')}</li></ul>
              <h3 className="font-bold">{tAge('sections.protection')}</h3>
              <ul className="list-disc pl-5"><li>{tAge('content.protection_li_1')}</li><li>{tAge('content.protection_li_2')}</li></ul>
              <div className="mt-4 rounded-xl border border-white/15 bg-white/[.04] p-4">
                <div className="font-semibold">{tAge('content.callout_title')}</div>
                <p className="text-sm text-white/70 mt-1 mb-0">{tAge('content.callout_body')}</p>
              </div>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}