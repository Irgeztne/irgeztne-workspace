(function (root) {
  const PROJECT_LANDING_TEMPLATE = {
    itemId: 'template-project-landing',
    templateId: 'project-landing',
    name: 'Project Landing',
    description: 'Широкий чистый one-page шаблон для проекта, услуги, портфолио, студии или малого бизнеса.',
    version: '0.5.0',
    installed: true,
    trust: 'built-in',
    template: {
      id: 'project-landing',
      name: 'Project Landing',
      category: 'website',
      description: 'Jadoo-style project landing without external images or external assets. Includes RU/EN and Day/Night controls.',
      defaults: {
        theme: 'light',
        kicker: 'Стартовый сайт',
        title: 'Ясная страница проекта',
        author: 'IRGEZTNE Studio',
        summary: 'Широкий чистый landing для проекта, услуги, портфолио, студии или малого бизнеса.',
        excerpt: 'Project Landing template prepared in IRGEZTNE Workspace.',
        seoTitle: 'Ясная страница проекта',
        seoDescription: 'Широкий чистый landing для проекта, услуги, портфолио, студии или малого бизнеса.',
        keywords: ['project', 'landing', 'website', 'portfolio', 'service', 'studio', 'business', 'irgeztne workspace'],
        tags: ['project', 'landing', 'website', 'ru-en', 'day-night'],
        visualHtml: `<style>
  .irgeztne-project-landing {
    --pl-bg: #fff8ef;
    --pl-cream: #fff1dc;
    --pl-card: #ffffff;
    --pl-card-soft: rgba(255,255,255,0.76);
    --pl-text: #181411;
    --pl-muted: #72685f;
    --pl-line: rgba(24,20,17,0.12);
    --pl-orange: #f2994a;
    --pl-orange-2: #df6951;
    --pl-blue: #5e74ff;
    --pl-yellow: #ffd166;
    --pl-shadow: 0 28px 80px rgba(68, 42, 18, 0.14);
    width: 100%;
    min-height: 760px;
    color: var(--pl-text);
    background:
      radial-gradient(circle at 80% 8%, rgba(94,116,255,0.12), transparent 30%),
      radial-gradient(circle at 16% 18%, rgba(242,153,74,0.18), transparent 32%),
      linear-gradient(180deg, #fffaf2 0%, var(--pl-bg) 48%, #fff 100%);
    border: 1px solid var(--pl-line);
    border-radius: 34px;
    overflow: hidden;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .irgeztne-project-landing[data-theme="night"] {
    --pl-bg: #111014;
    --pl-cream: #1c1821;
    --pl-card: #1f1b22;
    --pl-card-soft: rgba(31,27,34,0.78);
    --pl-text: #fff6ea;
    --pl-muted: #c8b9a9;
    --pl-line: rgba(255,246,234,0.14);
    --pl-orange: #ffac63;
    --pl-orange-2: #ff7f5c;
    --pl-blue: #8795ff;
    --pl-yellow: #ffd978;
    --pl-shadow: 0 28px 90px rgba(0, 0, 0, 0.36);
    background:
      radial-gradient(circle at 80% 8%, rgba(135,149,255,0.16), transparent 30%),
      radial-gradient(circle at 16% 18%, rgba(255,172,99,0.16), transparent 32%),
      linear-gradient(180deg, #17131a 0%, var(--pl-bg) 54%, #0d0c10 100%);
  }

  .irgeztne-project-landing * { box-sizing: border-box; }

  .irgeztne-project-landing,
  .irgeztne-project-landing h1,
  .irgeztne-project-landing h2,
  .irgeztne-project-landing h3,
  .irgeztne-project-landing strong,
  .irgeztne-project-landing a,
  .irgeztne-project-landing button,
  .irgeztne-project-landing .pl-title,
  .irgeztne-project-landing .pl-title *,
  .irgeztne-project-landing .pl-brand strong,
  .irgeztne-project-landing .pl-card-head strong,
  .irgeztne-project-landing .pl-feature strong,
  .irgeztne-project-landing .pl-work strong,
  .irgeztne-project-landing .pl-step strong,
  .irgeztne-project-landing .pl-metric strong,
  .irgeztne-project-landing .pl-float strong,
  .irgeztne-project-landing .pl-nav a,
  .irgeztne-project-landing .pl-pill,
  .irgeztne-project-landing .pl-button {
    color: var(--pl-text) !important;
  }

  .irgeztne-project-landing p,
  .irgeztne-project-landing span,
  .irgeztne-project-landing .pl-lead,
  .irgeztne-project-landing .pl-brand span,
  .irgeztne-project-landing .pl-card-head span,
  .irgeztne-project-landing .pl-feature p,
  .irgeztne-project-landing .pl-work p,
  .irgeztne-project-landing .pl-step p,
  .irgeztne-project-landing .pl-metric span,
  .irgeztne-project-landing .pl-float span,
  .irgeztne-project-landing .pl-section-head p,
  .irgeztne-project-landing .pl-footer,
  .irgeztne-project-landing .pl-footer * {
    color: var(--pl-muted) !important;
  }

  .irgeztne-project-landing .pl-kicker,
  .irgeztne-project-landing .pl-eyebrow,
  .irgeztne-project-landing .pl-icon,
  .irgeztne-project-landing .pl-chip {
    color: var(--pl-orange-2) !important;
  }

  .irgeztne-project-landing .pl-logo,
  .irgeztne-project-landing .pl-logo * {
    background: var(--pl-text) !important;
    color: var(--pl-bg) !important;
  }

  .irgeztne-project-landing .pl-button--primary,
  .irgeztne-project-landing .pl-button--primary * {
    color: #fff !important;
  }

  .irgeztne-project-landing .pl-status {
    color: #259957 !important;
  }

  .irgeztne-project-landing .pl-note,
  .irgeztne-project-landing .pl-note h2,
  .irgeztne-project-landing .pl-note p,
  .irgeztne-project-landing .pl-note .pl-eyebrow {
    color: #fff8ef !important;
  }

  .irgeztne-project-landing[data-theme="night"] .pl-note,
  .irgeztne-project-landing[data-theme="night"] .pl-note h2,
  .irgeztne-project-landing[data-theme="night"] .pl-note p,
  .irgeztne-project-landing[data-theme="night"] .pl-note .pl-eyebrow {
    color: #17131a !important;
  }


  /* Keep the template readable inside the editor even when the app/editor is in dark mode. */
  .irgeztne-project-landing,
  .irgeztne-project-landing .pl-title,
  .irgeztne-project-landing .pl-title *,
  .irgeztne-project-landing .pl-card-head strong,
  .irgeztne-project-landing .pl-feature strong,
  .irgeztne-project-landing .pl-work strong,
  .irgeztne-project-landing .pl-step strong,
  .irgeztne-project-landing .pl-metric strong,
  .irgeztne-project-landing .pl-float strong,
  .irgeztne-project-landing .pl-brand strong,
  .irgeztne-project-landing .pl-nav a,
  .irgeztne-project-landing .pl-pill,
  .irgeztne-project-landing .pl-button {
    color: var(--pl-text) !important;
  }

  .irgeztne-project-landing .pl-lead,
  .irgeztne-project-landing .pl-lead *,
  .irgeztne-project-landing .pl-brand span,
  .irgeztne-project-landing .pl-card-head span,
  .irgeztne-project-landing .pl-feature p,
  .irgeztne-project-landing .pl-work p,
  .irgeztne-project-landing .pl-step p,
  .irgeztne-project-landing .pl-metric span,
  .irgeztne-project-landing .pl-float span,
  .irgeztne-project-landing .pl-section-head p,
  .irgeztne-project-landing .pl-footer,
  .irgeztne-project-landing .pl-footer * {
    color: var(--pl-muted) !important;
  }

  .irgeztne-project-landing .pl-kicker,
  .irgeztne-project-landing .pl-eyebrow,
  .irgeztne-project-landing .pl-icon,
  .irgeztne-project-landing .pl-chip {
    color: var(--pl-orange-2) !important;
  }

  .irgeztne-project-landing .pl-logo {
    background: var(--pl-text) !important;
    color: var(--pl-bg) !important;
    font-size: 13px;
    line-height: 1;
    text-align: center;
    overflow: hidden;
  }

  .irgeztne-project-landing .pl-button--primary {
    color: #fff !important;
  }

  .irgeztne-project-landing .pl-status {
    color: #259957 !important;
  }

  .irgeztne-project-landing .pl-note,
  .irgeztne-project-landing .pl-note h2,
  .irgeztne-project-landing .pl-note p,
  .irgeztne-project-landing .pl-note .pl-eyebrow {
    color: #fff8ef !important;
  }

  .irgeztne-project-landing[data-theme="night"] .pl-note,
  .irgeztne-project-landing[data-theme="night"] .pl-note h2,
  .irgeztne-project-landing[data-theme="night"] .pl-note p,
  .irgeztne-project-landing[data-theme="night"] .pl-note .pl-eyebrow {
    color: #17131a !important;
  }


  .pl-shell {
    width: 100%;
    padding: clamp(24px, 3vw, 42px);
  }

  .pl-navrow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 22px;
  }

  .pl-brand {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    min-width: 230px;
  }

  .pl-logo {
    width: 46px;
    height: 46px;
    border-radius: 16px;
    display: grid;
    place-items: center;
    background: var(--pl-text);
    color: var(--pl-bg);
    font-weight: 950;
    font-size: 17px;
    line-height: 1;
    letter-spacing: -0.08em;
    box-shadow: 0 16px 40px rgba(0,0,0,0.14);
    position: relative;
    overflow: hidden;
  }

  /* Project logo is a clean CSS mark for preview. Logo/favicons generator comes next. */

  .pl-logo::after {
    content: "";
    position: absolute;
    width: 18px;
    height: 18px;
    right: -4px;
    bottom: -4px;
    border-radius: 8px;
    background: var(--pl-orange);
    opacity: 0.95;
  }

  .pl-brand strong {
    display: block;
    font-size: 15px;
    line-height: 1.1;
  }

  .pl-brand span {
    display: block;
    color: var(--pl-muted);
    font-size: 12px;
    margin-top: 3px;
  }

  .pl-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(14px, 2vw, 28px);
    flex: 1;
  }

  .pl-nav a {
    color: var(--pl-muted);
    text-decoration: none;
    font-size: 13px;
    font-weight: 800;
    white-space: nowrap;
  }

  .pl-nav a:hover { color: var(--pl-orange-2); }

  .pl-controls {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: flex-end;
    min-width: 190px;
  }

  .pl-pill {
    border: 1px solid var(--pl-line);
    background: var(--pl-card-soft);
    color: var(--pl-text);
    min-height: 38px;
    padding: 0 14px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 900;
    cursor: pointer;
    box-shadow: 0 10px 28px rgba(0,0,0,0.06);
  }

  .pl-pill:hover {
    border-color: rgba(242,153,74,0.55);
    transform: translateY(-1px);
  }

  .pl-hero {
    display: grid;
    grid-template-columns: minmax(0, 1.06fr) minmax(420px, 0.94fr);
    gap: clamp(34px, 5vw, 76px);
    align-items: center;
    padding: clamp(54px, 7vw, 92px) 0 clamp(42px, 6vw, 80px);
  }

  .pl-copy { min-width: 0; }

  .pl-kicker {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    color: var(--pl-orange-2);
    font-weight: 950;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-size: 13px;
    margin-bottom: 20px;
  }

  .pl-kicker:before {
    content: "";
    width: 34px;
    height: 3px;
    border-radius: 99px;
    background: var(--pl-orange-2);
  }

  .pl-title {
    margin: 0;
    max-width: 830px;
    font-size: clamp(52px, 6.8vw, 96px);
    line-height: 0.94;
    letter-spacing: -0.075em;
  }

  .pl-lead {
    max-width: 680px;
    margin: 24px 0 0;
    color: var(--pl-muted);
    font-size: clamp(17px, 1.7vw, 21px);
    line-height: 1.72;
  }

  .pl-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    margin-top: 32px;
  }

  .pl-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 50px;
    padding: 0 22px;
    border-radius: 14px;
    border: 1px solid var(--pl-line);
    text-decoration: none;
    color: var(--pl-text);
    background: var(--pl-card);
    font-size: 14px;
    font-weight: 950;
    box-shadow: 0 16px 42px rgba(0,0,0,0.08);
  }

  .pl-button--primary {
    border-color: transparent;
    color: #fff;
    background: linear-gradient(135deg, var(--pl-orange), var(--pl-orange-2));
    box-shadow: 0 20px 48px rgba(223,105,81,0.28);
  }

  .pl-mini-note {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 28px;
  }

  .pl-mini-note span {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: var(--pl-muted);
    background: var(--pl-card-soft);
    border: 1px solid var(--pl-line);
    border-radius: 999px;
    padding: 8px 11px;
    font-size: 12px;
    font-weight: 800;
  }

  .pl-mini-note span:before {
    content: "";
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--pl-orange);
  }

  .pl-visual {
    position: relative;
    min-height: 560px;
  }

  .pl-blob {
    position: absolute;
    inset: 0 0 0 8%;
    border-radius: 42% 58% 52% 48% / 46% 36% 64% 54%;
    background: linear-gradient(145deg, rgba(255,209,102,0.42), rgba(242,153,74,0.20) 42%, rgba(94,116,255,0.18));
  }

  .pl-blob:after {
    content: "";
    position: absolute;
    inset: 9%;
    border-radius: inherit;
    border: 1px solid var(--pl-line);
    background: rgba(255,255,255,0.18);
  }

  .pl-main-card {
    position: absolute;
    left: 3%;
    right: 5%;
    top: 12%;
    min-height: 410px;
    border-radius: 34px;
    background: var(--pl-card-soft);
    border: 1px solid var(--pl-line);
    box-shadow: var(--pl-shadow);
    padding: 24px;
    backdrop-filter: blur(14px);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .pl-card-head {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    align-items: flex-start;
  }

  .pl-card-head strong {
    display: block;
    font-size: 20px;
    letter-spacing: -0.03em;
  }

  .pl-card-head span {
    color: var(--pl-muted);
    font-size: 12px;
    font-weight: 800;
  }

  .pl-status {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    border-radius: 999px;
    background: rgba(79, 195, 126, 0.12);
    color: #259957;
    padding: 7px 10px;
    font-size: 12px;
    font-weight: 950;
    white-space: nowrap;
  }

  .pl-status:before {
    content: "";
    width: 8px;
    height: 8px;
    background: #38c172;
    border-radius: 50%;
  }

  .pl-bars {
    display: grid;
    gap: 12px;
    margin: 30px 0;
  }

  .pl-bar {
    height: 13px;
    border-radius: 999px;
    background: rgba(114,104,95,0.16);
    overflow: hidden;
  }

  .pl-bar i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--pl-orange), var(--pl-yellow));
  }

  .pl-bar:nth-child(1) i { width: 82%; }
  .pl-bar:nth-child(2) i { width: 66%; background: linear-gradient(90deg, var(--pl-blue), var(--pl-orange)); }
  .pl-bar:nth-child(3) i { width: 74%; }

  .pl-metrics {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .pl-metric {
    border: 1px solid var(--pl-line);
    background: var(--pl-card);
    border-radius: 22px;
    padding: 15px;
  }

  .pl-metric strong {
    display: block;
    font-size: 24px;
    letter-spacing: -0.05em;
  }

  .pl-metric span {
    display: block;
    color: var(--pl-muted);
    font-size: 11px;
    font-weight: 850;
    margin-top: 3px;
  }

  .pl-float {
    position: absolute;
    border: 1px solid var(--pl-line);
    background: var(--pl-card);
    border-radius: 22px;
    box-shadow: var(--pl-shadow);
    padding: 15px 17px;
    max-width: 210px;
  }

  .pl-float strong {
    display: block;
    font-size: 14px;
  }

  .pl-float span {
    display: block;
    color: var(--pl-muted);
    font-size: 12px;
    line-height: 1.45;
    margin-top: 4px;
  }

  .pl-float--one { left: -2%; top: 6%; }
  .pl-float--two { right: -1%; bottom: 9%; }

  .pl-section {
    padding: clamp(42px, 5vw, 74px) 0;
    border-top: 1px solid var(--pl-line);
  }

  .pl-section-head {
    display: grid;
    grid-template-columns: minmax(280px, 0.9fr) minmax(0, 1.1fr);
    gap: 32px;
    align-items: end;
    margin-bottom: 28px;
  }

  .pl-eyebrow {
    color: var(--pl-orange-2);
    font-size: 13px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-weight: 950;
    margin-bottom: 10px;
  }

  .pl-section h2 {
    margin: 0;
    font-size: clamp(34px, 4.2vw, 58px);
    line-height: 0.98;
    letter-spacing: -0.06em;
  }

  .pl-section-head p {
    color: var(--pl-muted);
    font-size: 16px;
    line-height: 1.72;
    margin: 0;
    max-width: 660px;
  }

  .pl-grid-4 {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
  }

  .pl-grid-3 {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }

  .pl-feature,
  .pl-work,
  .pl-step {
    background: var(--pl-card-soft);
    border: 1px solid var(--pl-line);
    border-radius: 28px;
    padding: 22px;
    box-shadow: 0 18px 44px rgba(0,0,0,0.06);
  }

  .pl-feature { min-height: 245px; }

  .pl-icon {
    width: 54px;
    height: 54px;
    border-radius: 18px;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, rgba(242,153,74,0.2), rgba(94,116,255,0.13));
    color: var(--pl-orange-2);
    font-weight: 950;
    margin-bottom: 28px;
  }

  .pl-feature strong,
  .pl-work strong,
  .pl-step strong {
    display: block;
    font-size: 21px;
    line-height: 1.12;
    letter-spacing: -0.035em;
  }

  .pl-feature p,
  .pl-work p,
  .pl-step p {
    color: var(--pl-muted);
    line-height: 1.65;
    margin: 12px 0 0;
    font-size: 14px;
  }

  .pl-work {
    min-height: 285px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .pl-work-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .pl-chip {
    display: inline-flex;
    border-radius: 999px;
    background: rgba(242,153,74,0.14);
    color: var(--pl-orange-2);
    padding: 7px 10px;
    font-size: 12px;
    font-weight: 950;
  }

  .pl-step {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 18px;
    align-items: start;
  }

  .pl-number {
    width: 64px;
    height: 64px;
    border-radius: 22px;
    display: grid;
    place-items: center;
    background: var(--pl-text);
    color: var(--pl-bg);
    font-size: 22px;
    font-weight: 950;
  }

  .pl-note {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 26px;
    align-items: center;
    background: linear-gradient(135deg, var(--pl-text), #3b2c22);
    color: #fff8ef;
    border-radius: 34px;
    padding: clamp(26px, 4vw, 44px);
    box-shadow: var(--pl-shadow);
  }

  .irgeztne-project-landing[data-theme="night"] .pl-note {
    background: linear-gradient(135deg, #fff6ea, #ead7c4);
    color: #17131a;
  }

  .pl-note h2 { color: inherit; }

  .pl-note p {
    color: currentColor;
    opacity: 0.78;
    max-width: 680px;
    line-height: 1.7;
    margin: 14px 0 0;
  }

  .pl-note .pl-button { box-shadow: none; }

  .pl-footer {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    color: var(--pl-muted);
    border-top: 1px solid var(--pl-line);
    padding: 26px 0 4px;
    font-size: 13px;
    font-weight: 750;
  }

  @media (max-width: 1120px) {
    .pl-hero { grid-template-columns: 1fr; }
    .pl-visual { min-height: 500px; }
    .pl-grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }

  @media (max-width: 820px) {
    .pl-shell { padding: 20px; }
    .pl-navrow { align-items: flex-start; flex-direction: column; }
    .pl-nav { justify-content: flex-start; flex-wrap: wrap; }
    .pl-controls { min-width: 0; }
    .pl-section-head,
    .pl-grid-3,
    .pl-note { grid-template-columns: 1fr; }
    .pl-grid-4 { grid-template-columns: 1fr; }
    .pl-title { font-size: clamp(42px, 14vw, 68px); }
    .pl-main-card { left: 0; right: 0; }
    .pl-float {
      position: relative;
      inset: auto;
      margin-top: 12px;
      max-width: none;
    }
  }
  /* Final color lock: app/editor dark themes must not wash out the template. */
  .irgeztne-project-landing,
  .irgeztne-project-landing * {
    opacity: 1 !important;
    filter: none !important;
    mix-blend-mode: normal !important;
  }

  .irgeztne-project-landing p,
  .irgeztne-project-landing .pl-lead,
  .irgeztne-project-landing .pl-lead *,
  .irgeztne-project-landing .pl-brand span,
  .irgeztne-project-landing .pl-card-head span,
  .irgeztne-project-landing .pl-feature p,
  .irgeztne-project-landing .pl-work p,
  .irgeztne-project-landing .pl-step p,
  .irgeztne-project-landing .pl-metric span,
  .irgeztne-project-landing .pl-float span,
  .irgeztne-project-landing .pl-section-head p,
  .irgeztne-project-landing .pl-footer,
  .irgeztne-project-landing .pl-footer * {
    color: var(--pl-muted) !important;
  }

  .irgeztne-project-landing,
  .irgeztne-project-landing h1,
  .irgeztne-project-landing h2,
  .irgeztne-project-landing h3,
  .irgeztne-project-landing strong,
  .irgeztne-project-landing .pl-title,
  .irgeztne-project-landing .pl-title *,
  .irgeztne-project-landing .pl-brand strong,
  .irgeztne-project-landing .pl-card-head strong,
  .irgeztne-project-landing .pl-feature strong,
  .irgeztne-project-landing .pl-work strong,
  .irgeztne-project-landing .pl-step strong,
  .irgeztne-project-landing .pl-metric strong,
  .irgeztne-project-landing .pl-float strong,
  .irgeztne-project-landing .pl-nav a,
  .irgeztne-project-landing .pl-pill,
  .irgeztne-project-landing .pl-button {
    color: var(--pl-text) !important;
  }

  .irgeztne-project-landing .pl-kicker,
  .irgeztne-project-landing .pl-eyebrow,
  .irgeztne-project-landing .pl-icon,
  .irgeztne-project-landing .pl-chip {
    color: var(--pl-orange-2) !important;
  }

  .irgeztne-project-landing .pl-logo,
  .irgeztne-project-landing .pl-logo * {
    background: var(--pl-text) !important;
    color: var(--pl-bg) !important;
  }

  .irgeztne-project-landing .pl-button--primary,
  .irgeztne-project-landing .pl-button--primary * {
    color: #fff !important;
  }

  .irgeztne-project-landing .pl-status {
    color: #259957 !important;
  }

  .irgeztne-project-landing .pl-note,
  .irgeztne-project-landing .pl-note h2,
  .irgeztne-project-landing .pl-note p,
  .irgeztne-project-landing .pl-note .pl-eyebrow {
    color: #fff8ef !important;
  }

  .irgeztne-project-landing[data-theme="night"] .pl-note,
  .irgeztne-project-landing[data-theme="night"] .pl-note h2,
  .irgeztne-project-landing[data-theme="night"] .pl-note p,
  .irgeztne-project-landing[data-theme="night"] .pl-note .pl-eyebrow {
    color: #17131a !important;
  }
  /* Project Landing final template fixes. */
  .irgeztne-project-landing .pl-number,
  .irgeztne-project-landing .pl-number * {
    background: var(--pl-text) !important;
    color: var(--pl-bg) !important;
    -webkit-text-fill-color: var(--pl-bg) !important;
  }

  .irgeztne-project-landing:not([data-theme="night"]) .pl-note,
  .irgeztne-project-landing:not([data-theme="night"]) .pl-note h2,
  .irgeztne-project-landing:not([data-theme="night"]) .pl-note p,
  .irgeztne-project-landing:not([data-theme="night"]) .pl-note .pl-eyebrow {
    color: #fff8ef !important;
    -webkit-text-fill-color: #fff8ef !important;
  }

  .irgeztne-project-landing[data-theme="night"] .pl-note,
  .irgeztne-project-landing[data-theme="night"] .pl-note h2,
  .irgeztne-project-landing[data-theme="night"] .pl-note p,
  .irgeztne-project-landing[data-theme="night"] .pl-note .pl-eyebrow {
    color: #17131a !important;
    -webkit-text-fill-color: #17131a !important;
  }

  .irgeztne-project-landing .pl-note .pl-button--primary,
  .irgeztne-project-landing .pl-note .pl-button--primary * {
    color: #fff !important;
    -webkit-text-fill-color: #fff !important;
  }
</style>

<div class="irgeztne-project-landing" data-theme="day" data-lang="ru">
  <div class="pl-shell">
    <header class="pl-navrow">
      <a class="pl-brand" href="#home" aria-label="Project Landing home" style="text-decoration:none;color:inherit;">
        <span class="pl-logo" aria-hidden="true">IR</span>
        <span>
          <strong>IRGEZTNE Project</strong>
          <span data-i18n data-ru="Проект / услуга / студия" data-en="Project / service / studio">Проект / услуга / студия</span>
        </span>
      </a>

      <nav class="pl-nav" aria-label="Project navigation">
        <a href="#service" data-i18n data-ru="Возможности" data-en="Services">Возможности</a>
        <a href="#work" data-i18n data-ru="Работа" data-en="Work">Работа</a>
        <a href="#process" data-i18n data-ru="Процесс" data-en="Process">Процесс</a>
        <a href="#contact" data-i18n data-ru="Контакт" data-en="Contact">Контакт</a>
      </nav>

      <div class="pl-controls">
        <button class="pl-pill" type="button" onclick="var r=this.closest('.irgeztne-project-landing');var l=r.getAttribute('data-lang')==='ru'?'en':'ru';r.setAttribute('data-lang',l);r.querySelectorAll('[data-i18n]').forEach(function(e){e.textContent=e.getAttribute('data-'+l)||e.textContent;});this.textContent=l==='ru'?'RU / EN':'EN / RU';">RU / EN</button>
        <button class="pl-pill" type="button" onclick="var r=this.closest('.irgeztne-project-landing');var n=r.getAttribute('data-theme')==='night'?'day':'night';r.setAttribute('data-theme',n);this.textContent=n==='night'?'Day':'Night';">Day / Night</button>
      </div>
    </header>

    <main>
      <section class="pl-hero" id="home">
        <div class="pl-copy">
          <div class="pl-kicker" data-i18n data-ru="Готовый старт для публикации" data-en="Launch-ready project starter">Готовый старт для публикации</div>
          <h1 class="pl-title"><span data-i18n data-ru="Создайте страницу, которая сразу объясняет проект." data-en="Create a page that explains the project at first glance.">Создайте страницу, которая сразу объясняет проект.</span></h1>
          <p class="pl-lead" data-i18n data-ru="Широкий чистый landing для проекта, услуги, портфолио, студии или малого бизнеса. Без лишних картинок, внешних зависимостей и случайных footer-ссылок." data-en="A clean wide landing page for a project, service, portfolio, studio, or small business. No extra images, no external dependencies, and no unwanted footer links.">Широкий чистый landing для проекта, услуги, портфолио, студии или малого бизнеса. Без лишних картинок, внешних зависимостей и случайных footer-ссылок.</p>

          <div class="pl-actions">
            <a class="pl-button pl-button--primary" href="#contact" data-i18n data-ru="Начать разговор" data-en="Start a conversation">Начать разговор</a>
            <a class="pl-button" href="#work" data-i18n data-ru="Посмотреть структуру" data-en="View the structure">Посмотреть структуру</a>
          </div>

          <div class="pl-mini-note">
            <span data-i18n data-ru="RU / EN" data-en="RU / EN">RU / EN</span>
            <span data-i18n data-ru="Day / Night" data-en="Day / Night">Day / Night</span>
            <span data-i18n data-ru="Export ZIP" data-en="Export ZIP">Export ZIP</span>
          </div>
        </div>

        <aside class="pl-visual" aria-label="Project preview illustration">
          <div class="pl-blob"></div>

          <div class="pl-main-card">
            <div class="pl-card-head">
              <div>
                <strong data-i18n data-ru="Панель проекта" data-en="Project board">Панель проекта</strong>
                <span data-i18n data-ru="Структура будущего сайта" data-en="Structure for the future site">Структура будущего сайта</span>
              </div>
              <span class="pl-status" data-i18n data-ru="Готово" data-en="Ready">Готово</span>
            </div>

            <div class="pl-bars">
              <div class="pl-bar"><i></i></div>
              <div class="pl-bar"><i></i></div>
              <div class="pl-bar"><i></i></div>
            </div>

            <div class="pl-metrics">
              <div class="pl-metric"><strong>01</strong><span data-i18n data-ru="Первый экран" data-en="Hero">Первый экран</span></div>
              <div class="pl-metric"><strong>04</strong><span data-i18n data-ru="Секции" data-en="Sections">Секции</span></div>
              <div class="pl-metric"><strong>ZIP</strong><span data-i18n data-ru="Экспорт" data-en="Export">Экспорт</span></div>
            </div>
          </div>

          <div class="pl-float pl-float--one">
            <strong data-i18n data-ru="Без картинок" data-en="No images">Без картинок</strong>
            <span data-i18n data-ru="Чистый CSS-блок, который легко заменить своим фото или иллюстрацией." data-en="A clean CSS block that can be replaced with your own photo or illustration.">Чистый CSS-блок, который легко заменить своим фото или иллюстрацией.</span>
          </div>

          <div class="pl-float pl-float--two">
            <strong data-i18n data-ru="Локально сначала" data-en="Local first">Локально сначала</strong>
            <span data-i18n data-ru="Соберите, проверьте preview и экспортируйте ZIP." data-en="Build, preview, and export a ZIP package.">Соберите, проверьте preview и экспортируйте ZIP.</span>
          </div>
        </aside>
      </section>

      <section class="pl-section" id="service">
        <div class="pl-section-head">
          <div>
            <div class="pl-eyebrow" data-i18n data-ru="Возможности" data-en="Services">Возможности</div>
            <h2 data-i18n data-ru="Покажите ценность без шума." data-en="Show the value without noise.">Покажите ценность без шума.</h2>
          </div>
          <p data-i18n data-ru="Эти карточки можно заменить на услуги, функции продукта, направления студии, преимущества портфолио или разделы локального бизнеса." data-en="Replace these cards with services, product features, studio directions, portfolio strengths, or local business sections.">Эти карточки можно заменить на услуги, функции продукта, направления студии, преимущества портфолио или разделы локального бизнеса.</p>
        </div>

        <div class="pl-grid-4">
          <article class="pl-feature">
            <div class="pl-icon">01</div>
            <strong data-i18n data-ru="Ясное предложение" data-en="Clear offer">Ясное предложение</strong>
            <p data-i18n data-ru="Скажите, что делает проект и какую проблему он решает." data-en="Say what the project does and which problem it solves.">Скажите, что делает проект и какую проблему он решает.</p>
          </article>

          <article class="pl-feature">
            <div class="pl-icon">02</div>
            <strong data-i18n data-ru="Доверие" data-en="Trust">Доверие</strong>
            <p data-i18n data-ru="Добавьте результат, факт, отзыв, кейс или короткое доказательство." data-en="Add a result, fact, testimonial, case, or proof point.">Добавьте результат, факт, отзыв, кейс или короткое доказательство.</p>
          </article>

          <article class="pl-feature">
            <div class="pl-icon">03</div>
            <strong data-i18n data-ru="Гибкая структура" data-en="Flexible structure">Гибкая структура</strong>
            <p data-i18n data-ru="Одна база подходит для проекта, студии, портфолио или услуги." data-en="One base works for a project, studio, portfolio, or service.">Одна база подходит для проекта, студии, портфолио или услуги.</p>
          </article>

          <article class="pl-feature">
            <div class="pl-icon">04</div>
            <strong data-i18n data-ru="Чистый экспорт" data-en="Clean export">Чистый экспорт</strong>
            <p data-i18n data-ru="Страница не зависит от внешних картинок и готова к ZIP-export." data-en="The page does not depend on external images and is ready for ZIP export.">Страница не зависит от внешних картинок и готова к ZIP-export.</p>
          </article>
        </div>
      </section>

      <section class="pl-section" id="work">
        <div class="pl-section-head">
          <div>
            <div class="pl-eyebrow" data-i18n data-ru="Работа" data-en="Work">Работа</div>
            <h2 data-i18n data-ru="Замените карточки своим содержанием." data-en="Replace the cards with your content.">Замените карточки своим содержанием.</h2>
          </div>
          <p data-i18n data-ru="Покажите три ключевых направления: продукт, услугу, публикацию, проект, кейс или следующий шаг для посетителя." data-en="Show three key directions: product, service, publication, project, case, or the next step for a visitor.">Покажите три ключевых направления: продукт, услугу, публикацию, проект, кейс или следующий шаг для посетителя.</p>
        </div>

        <div class="pl-grid-3">
          <article class="pl-work">
            <div class="pl-work-top">
              <span class="pl-chip">A</span>
              <span class="pl-chip" data-i18n data-ru="Главное" data-en="Core">Главное</span>
            </div>
            <div>
              <strong data-i18n data-ru="Направление проекта" data-en="Project direction">Направление проекта</strong>
              <p data-i18n data-ru="Опишите основную ветку проекта или продукта простым языком." data-en="Describe the main project or product direction in plain language.">Опишите основную ветку проекта или продукта простым языком.</p>
            </div>
          </article>

          <article class="pl-work">
            <div class="pl-work-top">
              <span class="pl-chip">B</span>
              <span class="pl-chip" data-i18n data-ru="Услуга" data-en="Service">Услуга</span>
            </div>
            <div>
              <strong data-i18n data-ru="Что можно заказать" data-en="What people can order">Что можно заказать</strong>
              <p data-i18n data-ru="Скажите, что пользователь может получить, скачать, прочитать или заказать." data-en="Say what a user can get, download, read, or order.">Скажите, что пользователь может получить, скачать, прочитать или заказать.</p>
            </div>
          </article>

          <article class="pl-work">
            <div class="pl-work-top">
              <span class="pl-chip">C</span>
              <span class="pl-chip" data-i18n data-ru="Рост" data-en="Growth">Рост</span>
            </div>
            <div>
              <strong data-i18n data-ru="Следующий шаг" data-en="Next step">Следующий шаг</strong>
              <p data-i18n data-ru="Дайте посетителю одно понятное действие вместо лишнего шума." data-en="Give the visitor one clear action instead of unnecessary noise.">Дайте посетителю одно понятное действие вместо лишнего шума.</p>
            </div>
          </article>
        </div>
      </section>

      <section class="pl-section" id="process">
        <div class="pl-section-head">
          <div>
            <div class="pl-eyebrow" data-i18n data-ru="Процесс" data-en="Process">Процесс</div>
            <h2 data-i18n data-ru="От черновика до ZIP." data-en="From draft to ZIP.">От черновика до ZIP.</h2>
          </div>
          <p data-i18n data-ru="Минимальный publishing flow: собрать статический сайт, открыть preview, экспортировать ZIP и открыть папку результата." data-en="Minimal publishing flow: build a static site, open preview, export ZIP, and open the output folder.">Минимальный publishing flow: собрать статический сайт, открыть preview, экспортировать ZIP и открыть папку результата.</p>
        </div>

        <div class="pl-grid-3">
          <article class="pl-step">
            <div class="pl-number">1</div>
            <div>
              <strong data-i18n data-ru="Соберите" data-en="Build">Соберите</strong>
              <p data-i18n data-ru="Подготовьте статическую страницу из текущего шаблона." data-en="Prepare a static page from the current template.">Подготовьте статическую страницу из текущего шаблона.</p>
            </div>
          </article>

          <article class="pl-step">
            <div class="pl-number">2</div>
            <div>
              <strong data-i18n data-ru="Проверьте" data-en="Preview">Проверьте</strong>
              <p data-i18n data-ru="Откройте сайт локально и проверьте текст, кнопки и секции." data-en="Open the site locally and check text, buttons, and sections.">Откройте сайт локально и проверьте текст, кнопки и секции.</p>
            </div>
          </article>

          <article class="pl-step">
            <div class="pl-number">3</div>
            <div>
              <strong data-i18n data-ru="Экспортируйте" data-en="Export">Экспортируйте</strong>
              <p data-i18n data-ru="Сохраните готовый сайт как ZIP для будущей публикации." data-en="Save the finished site as a ZIP for future publishing.">Сохраните готовый сайт как ZIP для будущей публикации.</p>
            </div>
          </article>
        </div>
      </section>

      <section class="pl-section" id="contact">
        <div class="pl-note">
          <div>
            <div class="pl-eyebrow" data-i18n data-ru="Контакт" data-en="Contact">Контакт</div>
            <h2 data-i18n data-ru="Оставьте один сильный финальный призыв." data-en="Leave one strong final call to action.">Оставьте один сильный финальный призыв.</h2>
            <p data-i18n data-ru="Замените этот блок на email, форму, ссылку на проект, download-кнопку или короткое сообщение для клиента." data-en="Replace this block with an email, form, project link, download button, or short message for a client.">Замените этот блок на email, форму, ссылку на проект, download-кнопку или короткое сообщение для клиента.</p>
          </div>
          <a class="pl-button pl-button--primary" href="#home" data-i18n data-ru="Вернуться наверх" data-en="Back to top">Вернуться наверх</a>
        </div>
      </section>
    </main>

    <footer class="pl-footer">
      <span>© Project Landing</span>
      <span data-i18n data-ru="Чистый footer без лишних внешних credit-ссылок." data-en="Clean footer without unwanted external credit links.">Чистый footer без лишних внешних credit-ссылок.</span>
    </footer>
  </div>
</div>`,
        markdown: `# Ясная страница проекта

Широкий чистый landing для проекта, услуги, портфолио, студии или малого бизнеса.

## Возможности

Покажите ценность без шума: предложение, доверие, структура, экспорт.

## Работа

Замените карточки на свои услуги, проекты, публикации или продуктовые направления.

## Процесс

Соберите статический сайт, проверьте preview, экспортируйте ZIP и откройте папку результата.

## Контакт

Замените финальный блок на email, форму, ссылку на проект или download-кнопку.`,
        blocks: [
          { type: 'heading-1', text: 'Ясная страница проекта' },
          { type: 'paragraph', text: 'Широкий чистый landing для проекта, услуги, портфолио, студии или малого бизнеса.' },
          { type: 'heading-2', text: 'Возможности' },
          { type: 'paragraph', text: 'Покажите ценность без шума: предложение, доверие, структура, экспорт.' },
          { type: 'heading-2', text: 'Работа' },
          { type: 'paragraph', text: 'Замените карточки на свои услуги, проекты, публикации или продуктовые направления.' },
          { type: 'heading-2', text: 'Процесс' },
          { type: 'paragraph', text: 'Соберите статический сайт, проверьте preview, экспортируйте ZIP и откройте папку результата.' },
          { type: 'heading-2', text: 'Контакт' },
          { type: 'paragraph', text: 'Замените финальный блок на email, форму, ссылку на проект или download-кнопку.' }
        ]
      }
    }
  };

  const TEMPLATE_DEFS = [PROJECT_LANDING_TEMPLATE];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getTemplateItems() {
    return clone(TEMPLATE_DEFS);
  }

  function getTemplates() {
    return TEMPLATE_DEFS.map((item) => clone(item.template));
  }

  function getTemplate(templateId) {
    const id = String(templateId || '').trim();
    const found = TEMPLATE_DEFS.find((item) => item.templateId === id || item.itemId === id || item.template.id === id);
    return clone((found || TEMPLATE_DEFS[0]).template);
  }

  function getItem(itemId) {
    const id = String(itemId || '').trim();
    const found = TEMPLATE_DEFS.find((item) => item.itemId === id || item.templateId === id || item.template.id === id);
    return clone(found || TEMPLATE_DEFS[0]);
  }

  function getTemplateDefs() {
    return clone(TEMPLATE_DEFS);
  }

  function toCatalogTemplateItem(def) {
    const template = def && def.template ? def.template : {};
    const defaults = template.defaults || {};
    const catalogId = String(def.itemId || ('catalog-template-' + (template.id || def.templateId || 'project-landing')));

    return {
      id: catalogId,
      itemId: catalogId,
      catalogItemId: catalogId,
      templateId: def.templateId || template.id || 'project-landing',
      type: 'template',
      title: def.name || template.name || 'Project Landing',
      name: def.name || template.name || 'Project Landing',
      description: def.description || template.description || defaults.summary || '',
      version: def.version || '0.1.0',
      installed: def.installed !== false,
      enabled: true,
      trust: def.trust || 'built-in',
      category: template.category || 'website',
      tags: Array.isArray(defaults.tags) ? defaults.tags.slice() : [],
      preview: {
        title: def.name || template.name || 'Project Landing',
        note: def.description || template.description || defaults.summary || '',
        tone: 'website',
        cta: 'Open in Editor'
      },
      compatibility: {
        nsBrowser: '8.x',
        moduleTarget: ['editor', 'catalog'],
        surface: ['workspace', 'cabinet'],
        minAppVersion: '8.0.0'
      }
    };
  }

  function listCatalogBuiltins() {
    return TEMPLATE_DEFS.map(toCatalogTemplateItem);
  }

  function getCatalogItem(itemId) {
    const id = String(itemId || '').trim();
    return listCatalogBuiltins().find(function (item) {
      return item.id === id || item.itemId === id || item.catalogItemId === id || item.templateId === id;
    }) || listCatalogBuiltins()[0];
  }

  function getTemplateByCatalogItemId(itemId) {
    const id = String(itemId || '').trim();
    const found = TEMPLATE_DEFS.find(function (item) {
      const template = item.template || {};
      return item.itemId === id || item.templateId === id || template.id === id || ('catalog-template-' + template.id) === id;
    }) || TEMPLATE_DEFS[0];

    const template = clone(found.template);
    template.catalogItemId = found.itemId || ('catalog-template-' + template.id);
    return template;
  }

  root.NSTemplateLibrary = {
    getTemplateDefs,
    getTemplateItems,
    getCatalogItems: getTemplateItems,
    getItems: getTemplateItems,
    getTemplates,
    getTemplate,
    getItem,
    listCatalogBuiltins,
    getCatalogItem,
    getTemplateByCatalogItemId
  };
})(window);
