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

    React.useEffect(() => {
      if (!open) return;

      const scrollY = window.scrollY;
      const previousOverflow = document.body.style.overflow;
      const previousPosition = document.body.style.position;
      const previousTop = document.body.style.top;
      const previousWidth = document.body.style.width;

      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';

      return () => {
        document.body.style.overflow = previousOverflow;
        document.body.style.position = previousPosition;
        document.body.style.top = previousTop;
        document.body.style.width = previousWidth;

        window.scrollTo(0, scrollY);
      };
    }, [open]);

  const updatedStr = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date());
  const articleClass =
    'prose prose-invert prose-sm sm:prose-base max-w-none ' +
    'prose-headings:text-white prose-p:text-white/80 prose-li:text-white/80';

  const titleClass =
    'mt-0 mb-3 !text-3xl sm:!text-4xl !font-semibold !leading-tight tracking-tight text-white';

  const subtitleClass =
    'mt-0 mb-2 !text-base sm:!text-lg !leading-relaxed text-white/65';

  const updatedClass =
    'mt-0 mb-8 !text-xs sm:!text-sm !leading-normal uppercase tracking-[0.08em] text-white/45';

  if (!open) return null;

  const activeLabel =
    initialTab === 'terms'
      ? tTerms('title')
      : initialTab === 'privacy'
        ? tPrivacy('title')
        : initialTab === 'imprint'
          ? tImprint('title')
          : tAge('title');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={activeLabel}
      className="fixed inset-0 z-[100] grid place-items-center p-4"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="
          relative
          w-full
          max-w-3xl
          overflow-hidden
          rounded-3xl
          border
          border-white/10
          bg-[#101014]
          shadow-[0_24px_80px_rgba(0,0,0,.72)]
        "
      >
        <div
          className="
            max-h-[82svh]
            overflow-y-auto
            overscroll-contain
            px-5
            pb-8
            pt-7
            sm:px-8
            sm:pt-8
          "
        >
          {initialTab === 'terms' && (
            <article className={articleClass}>
              <header className="mb-8 border-b border-white/10 pb-6">
                <h1 className={titleClass}>
                  {tTerms('title')}
                </h1>

                <p className={subtitleClass}>
                  {tTerms('subtitle')}
                </p>

                <p className={updatedClass}>
                  {tShared('updated')}: {updatedStr}
                </p>
              </header>
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

          {initialTab === 'privacy' && (
            <article className={articleClass}>
              <header className="mb-8 border-b border-white/10 pb-6">
                <h1 className={titleClass}>
                  {tPrivacy('title')}
                </h1>

                <p className={subtitleClass}>
                  {tPrivacy('subtitle')}
                </p>

                <p className={updatedClass}>
                  {tShared('updated')}: {updatedStr}
                </p>
              </header>
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

          {initialTab === 'imprint' && (
            <article className={articleClass}>
              <header className="mb-8 border-b border-white/10 pb-6">
                <h1 className={titleClass}>
                  {tImprint('title')}
                </h1>

                <p className={subtitleClass}>
                  {tImprint('subtitle')}
                </p>

                <p className={updatedClass}>
                  {tShared('updated')}: 30.08.2025
                </p>
              </header>

              <p className="text-white/80">
                {tImprint('content.line_1')}
                <br />
                Lyncora Media e.U.
                <br />
                5020 Salzburg
                <br />
                Österreich
              </p>

              <p className="mt-3">
                <strong>{tImprint('content.contact_label')}:</strong>{' '}
                <a
                  href="mailto:stephan.schmidbauer@subm8.com"
                  className="break-all text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
                >
                  stephan.schmidbauer@subm8.com
                </a>
              </p>

              <p>
                <strong>{tImprint('content.represented_by_label')}:</strong>{' '}
                Stephan Schmidbauer
              </p>

              <p>
                <strong>{tImprint('content.vat_label')}:</strong>{' '}
                No VAT according to § 6 para. 1 no. 27 UStG
              </p>

              <hr className="border-white/15" />

              <p className="text-sm text-white/60">
                {tImprint('content.adult_note')}
              </p>
            </article>
          )}

          {initialTab === 'age' && (
            <article className={articleClass}>
              <header className="mb-8 border-b border-white/10 pb-6">
                <h1 className={titleClass}>
                  {tAge('title')}
                </h1>

                <p className={subtitleClass}>
                  {tAge('subtitle')}
                </p>

                <p className={updatedClass}>
                  {tShared('updated')}: {updatedStr}
                </p>
              </header>
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