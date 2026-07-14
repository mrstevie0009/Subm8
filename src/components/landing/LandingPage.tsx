'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import LegalModal, { type LegalTab } from './LegalModal';
import LandingScrollScene from './LandingScrollScene';
import './landing.css';

type Mode = 'sub' | 'domme';

export default function LandingPage() {
  const locale = useLocale();
  const t = useTranslations('landing.landing');

  const [mode, setMode] = React.useState<Mode>('sub');
  const [wipeTo, setWipeTo] = React.useState<Mode | null>(null);
  const [particles, setParticles] = React.useState<
    { id: number; glyph: string; top: string; left: string; delay: string; size: string }[]
  >([]);
  const wiping = React.useRef(false);

  const [legalOpen, setLegalOpen] = React.useState(false);
  const [legalTab, setLegalTab] = React.useState<LegalTab>('terms');

  const rootRef = React.useRef<HTMLDivElement>(null);

  // ---- Rollenwechsel mit diagonalem Wipe ----
  function switchMode(next: Mode) {
    if (wiping.current || next === mode) return;
    wiping.current = true;
    setWipeTo(next);

    const glyphs =
      next === 'domme' ? ['👑', '✦', '♛', '✦', '👑', '◆'] : ['✦', '⟡', '·', '✦', '⟡', '◇'];
    const next14 = Array.from({ length: 14 }, (_, i) => ({
      id: i,
      glyph: glyphs[i % glyphs.length],
      top: `${Math.random() * 100}%`,
      left: `${10 + Math.random() * 70}%`,
      delay: `${Math.random() * 0.35}s`,
      size: `${12 + Math.random() * 16}px`,
    }));
    setParticles(next14);

    // Inhalt wechseln, wenn die Wipe-Front die Mitte erreicht
    window.setTimeout(() => setMode(next), 500);
    // Overlay nach Ende zurücksetzen
    window.setTimeout(() => {
      setWipeTo(null);
      wiping.current = false;
    }, 1120);
  }

  // ---- Scroll-Reveal ----
  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    const revealEls = Array.from(root.querySelectorAll('.lp-reveal'));
    revealEls.forEach((el, i) => {
      (el as HTMLElement).style.transitionDelay = `${(i % 3) * 0.08}s`;
      io.observe(el);
    });

    return () => {
      io.disconnect();
    };
  }, []);

  function openLegal(tab: LegalTab) {
    setLegalTab(tab);
    setLegalOpen(true);
  }

  const signup = `/${locale}/signup`;
  const signin = `/${locale}/signin`;

  return (
    <div className="lp-root" data-mode={mode} ref={rootRef}>
      {/* Ambient glow */}
      <div className="lp-ambient" aria-hidden="true">
        <div className="lp-orb lp-orb-1" />
        <div className="lp-orb lp-orb-2" />
      </div>

      {/* Scroll-getriebene 3D-Figur */}
      <LandingScrollScene mode={mode} />

      {/* Diagonal wipe overlay */}
      {wipeTo && (
        <div className="lp-wipe run" data-to={wipeTo} aria-hidden="true">
          <div className="lp-wipe-sheet" />
          {particles.map((p) => (
            <span
              key={p.id}
              className="lp-particle"
              style={{ top: p.top, left: p.left, animationDelay: p.delay, fontSize: p.size }}
            >
              {p.glyph}
            </span>
          ))}
        </div>
      )}

      {/* NAV */}
      <nav className="lp-nav">
        <div className="lp-wrap">
          <div className="lp-nav-in">
            <div className="lp-logo">
              <Image
                src="/subm8-logo.png"
                alt="Subm8"
                width={120}
                height={32}
                priority
                className="lp-logo-img"
              />
            </div>

            <div className="lp-logo">
              <Image
                src="/Icon.png"
                alt="Subm8"
                width={50}
                height={32}
                priority
                className="lp-logo-img"
              />
            </div>

            <div className="lp-nav-cta">
              <Link href={signin} className="lp-btn lp-btn-ghost">
                {t('nav.signin')}
              </Link>

              <Link href={signup} className="lp-btn lp-btn-primary">
                {t('nav.signup')}
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="lp-toggle-wrap">
        <div className="lp-toggle" role="tablist" aria-label={t('toggle.aria')}>
          <span className="lp-pill" aria-hidden="true" />

          <button type="button" role="tab" data-set="sub" onClick={() => switchMode('sub')}>
            {t('toggle.sub')}
          </button>

          <button type="button" role="tab" data-set="domme" onClick={() => switchMode('domme')}>
            {t('toggle.domme')}
          </button>
        </div>
      </div>

      {/* HERO */}
      <header className="lp-hero">
        <div className="lp-wrap lp-hero-grid">
          <div>
            <span className="lp-eyebrow">
              <span className="lp-dot" />
              <span className="m-sub">{t('hero.eyebrow.sub')}</span>
              <span className="m-domme">{t('hero.eyebrow.domme')}</span>
            </span>
            <h1 className="lp-display" style={{ fontSize: 'clamp(44px,5.6vw,74px)', marginBottom: 22 }}>
              <span className="m-sub" dangerouslySetInnerHTML={{ __html: t.raw('hero.title.sub') }} />
              <span className="m-domme" dangerouslySetInnerHTML={{ __html: t.raw('hero.title.domme') }} />
            </h1>
            <p className="lp-hero-sub">
              <span className="m-sub">{t('hero.sub.sub')}</span>
              <span className="m-domme">{t('hero.sub.domme')}</span>
            </p>
            <div className="lp-hero-cta">
              <Link href={signup} className="lp-btn lp-btn-primary lp-btn-lg">
                <span className="m-sub">{t('hero.cta.sub')}</span>
                <span className="m-domme">{t('hero.cta.domme')}</span>
              </Link>
              <Link href={signin} className="lp-btn lp-btn-ghost lp-btn-lg">
                {t('nav.signin')}
              </Link>
            </div>
            <div className="lp-trust">
              <span className="lp-trust-ico">
                <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4M12 3l8 4v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V7l8-4z"
                  />
                </svg>
              </span>
              <p>{t('hero.trust')}</p>
            </div>
          </div>

          {/* Platz für die 3D-Figur (Canvas liegt fix dahinter) */}
          <div className="lp-visual lp-visual-scene" aria-hidden="true" />
        </div>
      </header>

      {/* MARQUEE */}
      <div className="lp-marquee">
        <div className="lp-marquee-track">
          {[0, 1].map((dup) =>
            ['tributes', 'autodrain', 'ownership', 'contracts', 'premium', 'chats', 'communities'].map(
              (k) => (
                <span className="lp-marquee-item" key={`${dup}-${k}`}>
                  {t(`marquee.${k}`)}
                </span>
              ),
            ),
          )}
        </div>
      </div>

      {/* HIGHLIGHT */}
      <section className="lp-block" style={{ paddingBottom: 20 }}>
        <div className="lp-wrap">
          <div className="lp-sec-head lp-reveal">
            <div className="lp-sec-eyebrow">
              <span className="m-sub">{t('highlight.eyebrow.sub')}</span>
              <span className="m-domme">{t('highlight.eyebrow.domme')}</span>
            </div>
            <h2 className="lp-display" style={{ fontSize: 'clamp(32px,4vw,46px)' }}>
              <span className="m-sub" dangerouslySetInnerHTML={{ __html: t.raw('highlight.title.sub') }} />
              <span className="m-domme" dangerouslySetInnerHTML={{ __html: t.raw('highlight.title.domme') }} />
            </h2>
          </div>
          <div className="lp-highlight">
            {(['a', 'b', 'c'] as const).map((k) => (
              <div className="lp-hl m-sub lp-reveal" key={`hl-sub-${k}`}>
                <div className="lp-hl-k k">{t(`highlight.sub.${k}.k`)}</div>
                <h3>{t(`highlight.sub.${k}.h`)}</h3>
                <p>{t(`highlight.sub.${k}.p`)}</p>
              </div>
            ))}
            {(['a', 'b', 'c'] as const).map((k) => (
              <div className="lp-hl m-domme lp-reveal" key={`hl-domme-${k}`}>
                <div className="lp-hl-k k">{t(`highlight.domme.${k}.k`)}</div>
                <h3>{t(`highlight.domme.${k}.h`)}</h3>
                <p>{t(`highlight.domme.${k}.p`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="lp-block" id="features">
        <div className="lp-wrap">
          <div className="lp-sec-head lp-reveal">
            <div className="lp-sec-eyebrow">{t('features.eyebrow')}</div>
            <h2
              className="lp-display"
              style={{ fontSize: 'clamp(32px,4vw,46px)' }}
              dangerouslySetInnerHTML={{ __html: t.raw('features.title') }}
            />
            <p className="lp-sec-sub">
              <span className="m-sub">{t('features.sub.sub')}</span>
              <span className="m-domme">{t('features.sub.domme')}</span>
            </p>
          </div>
          <div className="lp-feat-grid">
            {FEATURES.map((f) => (
              <div className="lp-feat lp-reveal" key={f.key}>
                <div className="lp-feat-ico">{f.icon}</div>
                <h3>{t(`features.items.${f.key}.h`)}</h3>
                <p>
                  <span className="m-sub">{t(`features.items.${f.key}.sub`)}</span>
                  <span className="m-domme">{t(`features.items.${f.key}.domme`)}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW */}
      <section className="lp-block" id="how" style={{ paddingTop: 20 }}>
        <div className="lp-wrap">
          <div className="lp-sec-head lp-reveal">
            <div className="lp-sec-eyebrow">{t('how.eyebrow')}</div>
            <h2
              className="lp-display"
              style={{ fontSize: 'clamp(32px,4vw,46px)' }}
              dangerouslySetInnerHTML={{ __html: t.raw('how.title') }}
            />
          </div>
          <div className="lp-steps">
            <div className="lp-step lp-reveal">
              <div className="lp-step-num">01</div>
              <h3>{t('how.s1.h')}</h3>
              <p>{t('how.s1.p')}</p>
            </div>
            <div className="lp-step lp-reveal">
              <div className="lp-step-num">02</div>
              <h3>{t('how.s2.h')}</h3>
              <p>
                <span className="m-sub">{t('how.s2.sub')}</span>
                <span className="m-domme">{t('how.s2.domme')}</span>
              </p>
            </div>
            <div className="lp-step lp-reveal">
              <div className="lp-step-num">03</div>
              <h3>
                <span className="m-sub">{t('how.s3.h_sub')}</span>
                <span className="m-domme">{t('how.s3.h_domme')}</span>
              </h3>
              <p>
                <span className="m-sub">{t('how.s3.sub')}</span>
                <span className="m-domme">{t('how.s3.domme')}</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SAFETY */}
      <section className="lp-block" id="safety" style={{ paddingTop: 20 }}>
        <div className="lp-wrap">
          <div className="lp-sec-head lp-reveal">
            <div className="lp-sec-eyebrow">{t('safety.eyebrow')}</div>
            <h2
              className="lp-display"
              style={{ fontSize: 'clamp(32px,4vw,46px)' }}
              dangerouslySetInnerHTML={{ __html: t.raw('safety.title') }}
            />
            <p className="lp-sec-sub">{t('safety.sub')}</p>
          </div>
          <div className="lp-safety">
            <div className="lp-chip lp-reveal">{t('safety.chips.age')}</div>
            <div className="lp-chip lp-reveal">{t('safety.chips.stripe')}</div>
            <div className="lp-chip lp-reveal">{t('safety.chips.anon')}</div>
            <div className="lp-chip lp-reveal m-sub">{t('safety.chips.budget')}</div>
            <div className="lp-chip lp-reveal m-domme">{t('safety.chips.payouts')}</div>
            <div className="lp-chip lp-reveal">{t('safety.chips.history')}</div>
          </div>
        </div>
      </section>

      {/* FINAL */}
      <section className="lp-final">
        <div className="lp-wrap">
          <div className="lp-final-card lp-reveal">
            <h2 className="lp-display" style={{ fontSize: 'clamp(34px,4.4vw,52px)', marginBottom: 18 }}>
              <span className="m-sub" dangerouslySetInnerHTML={{ __html: t.raw('final.title.sub') }} />
              <span className="m-domme" dangerouslySetInnerHTML={{ __html: t.raw('final.title.domme') }} />
            </h2>
            <p>
              <span className="m-sub">{t('final.p.sub')}</span>
              <span className="m-domme">{t('final.p.domme')}</span>
            </p>
            <Link href={signup} className="lp-btn lp-btn-primary lp-btn-lg">
              <span className="m-sub">{t('hero.cta.sub')}</span>
              <span className="m-domme">{t('hero.cta.domme')}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="lp-wrap">
          <div className="lp-foot-in">
            <div className="lp-foot-brand">
              <div className="lp-logo">
                <Image src="/logo-bigger.png" alt="Subm8" width={120} height={32} className="lp-logo-img" />
              </div>
              <p>{t('footer.tagline')}</p>
            </div>
            <div className="lp-foot-cols">
              <div className="lp-foot-col">
                <h4>{t('footer.platform')}</h4>
                <a href="#features">{t('features.eyebrow')}</a>
                <a href="#how">{t('how.eyebrow')}</a>
                <a href="#safety">{t('safety.eyebrow')}</a>
                <Link href={signup}>{t('nav.signup')}</Link>
              </div>
              <div className="lp-foot-col">
                <h4>{t('footer.legal')}</h4>
                <a onClick={() => openLegal('terms')}>{t('footer.terms')}</a>
                <a onClick={() => openLegal('privacy')}>{t('footer.privacy')}</a>
                <a onClick={() => openLegal('imprint')}>{t('footer.imprint')}</a>
                <a onClick={() => openLegal('age')}>{t('footer.age')}</a>
              </div>
              <div className="lp-foot-col">
                <h4>{t('footer.account')}</h4>
                <Link href={signin}>{t('nav.signin')}</Link>
                <Link href={signup}>{t('nav.signup')}</Link>
              </div>
            </div>
          </div>
          <div className="lp-foot-bottom">
            <span>{t('footer.copyright')}</span>
            <span className="lp-age">
              <b>18</b> {t('footer.adults')}
            </span>
          </div>
        </div>
      </footer>

      <LegalModal open={legalOpen} onClose={() => setLegalOpen(false)} initialTab={legalTab} />
    </div>
  );
}

/* Feature-Icons (rein visuell, kein Text) */
const FEATURES: { key: string; icon: React.ReactNode }[] = [
  { key: 'tributes', icon: <IconPath d="M12 6v12m-3-2.8c0 1.5 1.3 2.3 3 2.3s3-.8 3-2.3-1.3-2.1-3-2.5-3-1-3-2.5 1.3-2.2 3-2.2 3 .7 3 2.2" /> },
  { key: 'autodrain', icon: <IconPath d="M4 4v5h.6M20 20v-5h-.6M18.4 9A8 8 0 0 0 5.6 6M5.6 15A8 8 0 0 0 18.4 18" /> },
  { key: 'ownership', icon: <IconPath d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 3l1.5 3 3.3.5-2.4 2.3.6 3.3L12 14l-3 1.6.6-3.3L7.2 9l3.3-.5L12 3z" /> },
  { key: 'contracts', icon: <IconPath d="M9 12h6m-6 4h4m1-11H8a2 2 0 0 0-2 2v13a1 1 0 0 0 1.5.9L12 19l4.5 1.9A1 1 0 0 0 18 20V7a2 2 0 0 0-2-2z" /> },
  { key: 'chats', icon: <IconPath d="M8 12h8M8 8h8m-8 8h5m4-10v10a2 2 0 0 1-2 2H7l-4 3V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" /> },
  { key: 'communities', icon: <IconPath d="M17 20h5v-2a4 4 0 0 0-3-3.9M9 20H4v-2a4 4 0 0 1 3-3.9m10-4a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM7 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /> },
  { key: 'premium', icon: <IconPath d="M12 3l2.4 5 5.6.7-4 3.9 1 5.5L12 20.6 7 18l1-5.5-4-3.9L9.6 8 12 3z" /> },
  { key: 'banners', icon: <IconPath d="M3 5h18v14H3V5zm7 3.5v7l6-3.5-6-3.5z" /> },
  { key: 'safe', icon: <IconPath d="M12 2l8 4v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-4z" /> },
];

function IconPath({ d }: { d: string }) {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}