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
                src="/logo-bigger.png"
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
            <div className="lp-chip lp-chip-age lp-reveal">
              {t('safety.chips.age')}
            </div>

            <div className="lp-chip lp-chip-stripe lp-reveal">
              {t('safety.chips.stripe')}
            </div>

            <div className="lp-chip lp-chip-anon lp-reveal">
              {t('safety.chips.anon')}
            </div>

            <div className="lp-chip lp-chip-role lp-reveal m-sub">
              {t('safety.chips.budget')}
            </div>

            <div className="lp-chip lp-chip-role lp-reveal m-domme">
              {t('safety.chips.payouts')}
            </div>

            <div className="lp-chip lp-chip-history lp-reveal">
              {t('safety.chips.history')}
            </div>
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

/* =========================================================
   Feature-Icons
   Bestehende Website-Icons + neue einheitliche Line-Icons
========================================================= */

const FEATURES: { key: string; icon: React.ReactNode }[] = [
  {
    key: 'tributes',
    icon: <LandingTipIcon />,
  },
  {
    key: 'autodrain',
    icon: <AutoDrainIcon />,
  },
  {
    key: 'ownership',
    icon: <OwnershipIcon />,
  },
  {
    key: 'contracts',
    icon: <ContractIcon />,
  },
  {
    key: 'chats',
    icon: <LandingChatIcon />,
  },
  {
    key: 'communities',
    icon: <CommunityIcon />,
  },
  {
    key: 'premium',
    icon: <PremiumIcon />,
  },
  {
    key: 'banners',
    icon: <BannerIcon />,
  },
  {
    key: 'safe',
    icon: <SafetyIcon />,
  },
];

type FeatureIconProps = React.SVGProps<SVGSVGElement>;

const lineIconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

/*
 * Dasselbe Dollar-/Tip-Symbol, das du bereits
 * im ProfileHeader verwendest.
 */
function LandingTipIcon(props: FeatureIconProps) {
  return (
    <svg
      viewBox="0 0 50 50"
      fill="currentColor"
      aria-hidden
      {...props}
    >
      <g transform="translate(24 25) scale(1.45) translate(-25 -25)">
        <path d="M24 14v2.1875c-1.6016.1992-4.5 1.6016-4.5 5 0 6.3984 9.3125 3.1055 9.3125 7.9063 0 1.6015-.7109 3.0937-3.8125 3.0937S21 29.8008 21 28.5h-2c.3008 4.3008 3.3008 5.293 5 5.5938V36h2v-1.9062c1.5-.1016 5-1.1875 5-5.1875 0-3.3008-2.7109-4.211-5.3125-4.8125-2.1016-.5-4-1-4-3.0938 0-.8984.4063-2.9062 3.4063-2.9062 2.1015 0 3.1054 1.3046 3.4062 2.9062h2c-.6016-2.1992-1.6016-4.1875-4.5-4.6875V14Z" />
      </g>
    </svg>
  );
}

/*
 * AutoDrain:
 * Wiederkehrender Kreislauf mit einem kleinen Pfeil.
 */
function AutoDrainIcon(props: FeatureIconProps) {
  return (
    <svg {...lineIconProps} {...props}>
      <path d="M10 15.5C9.3627 16.603 8.99715 17 7.49786 17C5.49881 17 3 15.4038 3 12.7143C3 9.71425 4.72398 8.00004 7.49786 8C12.058 7.99993 11.496 17 16.4936 17C19.5997 17 20.8679 14.9635 20.9914 12.7143C21.122 10.3382 19.7654 8 16.4936 8C14.4945 8 14.1091 8.42857 13.5 9.5" />
    </svg>
  );
}

/*
 * Ownership:
 * Halsband/Collar mit Ring – klarer als der bisherige Stern.
 */
function OwnershipIcon(props: FeatureIconProps) {
  return (
    <svg {...lineIconProps} {...props}>
      {/* O-Ring */}
      <circle cx="12" cy="10" r="5.2" />

      {/* Anhänger */}
      <line x1="12" y1="15.2" x2="12" y2="16.6" />
      <circle cx="12" cy="18.5" r="2.3" />
    </svg>
  );
}

/*
 * Contracts:
 * Dokument mit Text und Unterschrift.
 */
function ContractIcon(props: FeatureIconProps) {
  return (
    <svg {...lineIconProps} {...props}>
      <path d="M7 3.5h7l3 3V20a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 6 20V5A1.5 1.5 0 0 1 7.5 3.5Z" />
      <path d="M14 3.5V7h3" />
      <path d="M9 10h5" />
      <path d="M9 13h5" />
      <path d="M9 16h5" />
    </svg>
  );
}

/*
 * Dasselbe Chat-Grundsymbol wie auf deiner Website,
 * aber sauber auf die Feature-Karte skaliert.
 */
function LandingChatIcon(props: FeatureIconProps) {
  return (
    <svg
      viewBox="0 0 50 50"
      fill="currentColor"
      aria-hidden
      {...props}
    >
      <path d="M43 8H7c-2.7578 0-5 2.2422-5 5v24c0 2.7578 2.2422 5 5 5h4.1406c.3399 2.8945-.5156 4.8594-2.6562 6.1445-.3828.2305-.5664.6914-.4492 1.1211C8.1562 49.6992 8.5508 50 9 50c2.5586 0 8.707-.7969 11.6836-8H43c2.7578 0 5-2.2422 5-5V13c0-2.7578-2.2422-5-5-5ZM15 27a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm10 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm10 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
    </svg>
  );
}

/*
 * Communities:
 * Drei Personen statt des schwer erkennbaren alten Symbols.
 */
function CommunityIcon(props: FeatureIconProps) {
  return (
    <svg {...lineIconProps} {...props}>
      <circle cx="12" cy="8" r="3" />
      <circle cx="5.5" cy="10" r="2.2" />
      <circle cx="18.5" cy="10" r="2.2" />

      <path d="M7 20v-1.2A4.8 4.8 0 0 1 11.8 14h.4a4.8 4.8 0 0 1 4.8 4.8V20" />
      <path d="M2.5 19v-.8a3.7 3.7 0 0 1 3.7-3.7" />
      <path d="M21.5 19v-.8a3.7 3.7 0 0 0-3.7-3.7" />
    </svg>
  );
}

/*
 * Premium:
 * Badge-Sechseck mit Stern.
 */
function PremiumIcon(props: FeatureIconProps) {
  return (
    <svg {...lineIconProps} {...props}>
      <path d="m12 2.8 2.3 1.5 2.8-.1.9 2.7 2.3 1.6-.9 2.6.9 2.7-2.3 1.6-.9 2.7-2.8-.1-2.3 1.5-2.3-1.5-2.8.1-.9-2.7-2.3-1.6.9-2.7-.9-2.6L6 6.9l.9-2.7 2.8.1L12 2.8Z" />
      <path d="m12 7.4 1.2 2.4 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4L12 7.4Z" />
    </svg>
  );
}

/*
 * Animated Banners:
 * Bildschirm mit Play-Symbol und Bewegungslinien.
 */
function BannerIcon(props: FeatureIconProps) {
  return (
    <svg {...lineIconProps} {...props}>
      <rect x="3" y="5" width="18" height="13" rx="2" />
      <path d="m10 9 5 2.5-5 2.5V9Z" />
      <path d="M8 21h8" />
      <path d="M12 18v3" />
    </svg>
  );
}

/*
 * Sicherheit:
 * Schild mit Häkchen.
 */
function SafetyIcon(props: FeatureIconProps) {
  return (
    <svg {...lineIconProps} {...props}>
      <path d="M12 3 20 6.5v5.2c0 4.8-3.1 8.1-8 9.8-4.9-1.7-8-5-8-9.8V6.5L12 3Z" />
      <path d="m8.5 12 2.2 2.2 4.8-5" />
    </svg>
  );
}