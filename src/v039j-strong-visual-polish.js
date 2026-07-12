/* IRGEZTNE Workspace v039j — inject strongest visual polish last */
(function () {
  'use strict';

  const CSS_ID = 'irgeztne-v039j-strong-visual-polish-runtime';

  const css = `/* IRGEZTNE Workspace v039j — strong visual polish
   Purpose:
   - make Rooms live card use the right panel width instead of becoming a skinny column;
   - force clock/calendar compact Home row alignment;
   - override both newer calendar-toggle and older calendar-fold summary variants.
*/

/* =========================================================
   1) Workspace compact Home: align clock + calendar card
   ========================================================= */

/* Known top-row variants. */
.ir-wc-v07 .ir-wc-compact-head,
.ir-wc-v07 .ir-wc-top-row,
.ir-wc-v07 .ir-wc-dashboard-top,
.ir-wc-v07 .ir-wc-home-top,
.ir-wc-v07 .ir-wc-time-row,
.ir-wc-v04 .ir-wc-compact-head,
.ir-wc-v04 .ir-wc-top-row,
.ir-wc-v04 .ir-wc-dashboard-top,
.ir-wc-v04 .ir-wc-home-top,
.ir-wc-v04 .ir-wc-time-row {
  align-items: start !important;
}

/* Clock cards: keep compact and aligned to the top of the row. */
.ir-wc-v07 .ir-wc-time-card,
.ir-wc-v07 .ir-wc-clock-card,
.ir-wc-v07 .ir-wc-time,
.ir-wc-v07 [class*="time-card"],
.ir-wc-v07 [class*="clock-card"],
.ir-wc-v04 .ir-wc-time-card,
.ir-wc-v04 .ir-wc-clock-card,
.ir-wc-v04 .ir-wc-time,
.ir-wc-v04 [class*="time-card"],
.ir-wc-v04 [class*="clock-card"] {
  min-height: 56px !important;
  height: 56px !important;
  align-self: start !important;
  display: grid !important;
  align-content: center !important;
  padding-top: 8px !important;
  padding-bottom: 8px !important;
  box-sizing: border-box !important;
}

/* Newer calendar button. */
.ir-wc-v07 .ir-wc-calendar-toggle,
.ir-wc-v04 .ir-wc-calendar-toggle {
  min-height: 56px !important;
  height: 56px !important;
  align-self: start !important;
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) auto 16px !important;
  grid-template-rows: 1fr !important;
  align-items: center !important;
  gap: 10px !important;
  padding: 8px 14px !important;
  box-sizing: border-box !important;
  transform: none !important;
}

/* Older details/summary calendar button. */
.ir-wc-v07 .ir-wc-calendar-fold,
.ir-wc-v04 .ir-wc-calendar-fold {
  align-self: start !important;
  margin-top: 0 !important;
}

.ir-wc-v07 .ir-wc-calendar-fold > summary,
.ir-wc-v04 .ir-wc-calendar-fold > summary {
  min-height: 56px !important;
  height: 56px !important;
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) auto 16px !important;
  grid-template-rows: 1fr !important;
  align-items: center !important;
  gap: 10px !important;
  padding: 8px 14px !important;
  box-sizing: border-box !important;
  transform: none !important;
}

/* Calendar inner text must not drop down. */
.ir-wc-v07 .ir-wc-calendar-toggle span,
.ir-wc-v07 .ir-wc-calendar-toggle strong,
.ir-wc-v07 .ir-wc-calendar-toggle em,
.ir-wc-v04 .ir-wc-calendar-toggle span,
.ir-wc-v04 .ir-wc-calendar-toggle strong,
.ir-wc-v04 .ir-wc-calendar-toggle em,
.ir-wc-v07 .ir-wc-calendar-fold > summary span,
.ir-wc-v07 .ir-wc-calendar-fold > summary strong,
.ir-wc-v07 .ir-wc-calendar-fold > summary em,
.ir-wc-v04 .ir-wc-calendar-fold > summary span,
.ir-wc-v04 .ir-wc-calendar-fold > summary strong,
.ir-wc-v04 .ir-wc-calendar-fold > summary em {
  align-self: center !important;
  margin-top: 0 !important;
  margin-bottom: 0 !important;
  line-height: 1.12 !important;
  transform: none !important;
}

.ir-wc-v07 .ir-wc-calendar-toggle span,
.ir-wc-v04 .ir-wc-calendar-toggle span,
.ir-wc-v07 .ir-wc-calendar-fold > summary span,
.ir-wc-v04 .ir-wc-calendar-fold > summary span {
  grid-column: 1 !important;
  grid-row: 1 !important;
  justify-self: start !important;
}

.ir-wc-v07 .ir-wc-calendar-toggle strong,
.ir-wc-v04 .ir-wc-calendar-toggle strong,
.ir-wc-v07 .ir-wc-calendar-fold > summary strong,
.ir-wc-v04 .ir-wc-calendar-fold > summary strong {
  grid-column: 2 !important;
  grid-row: 1 !important;
  justify-self: end !important;
  white-space: nowrap !important;
}

.ir-wc-v07 .ir-wc-calendar-toggle em,
.ir-wc-v04 .ir-wc-calendar-toggle em,
.ir-wc-v07 .ir-wc-calendar-fold > summary em,
.ir-wc-v04 .ir-wc-calendar-fold > summary em {
  grid-column: 3 !important;
  grid-row: 1 !important;
  justify-self: end !important;
}

/* CSS arrow fallback should also stay centered. */
.ir-wc-v07 .ir-wc-calendar-toggle::after,
.ir-wc-v04 .ir-wc-calendar-toggle::after,
.ir-wc-v07 .ir-wc-calendar-fold > summary::after,
.ir-wc-v04 .ir-wc-calendar-fold > summary::after {
  align-self: center !important;
  margin-top: 0 !important;
  transform: none !important;
}

/* Open calendar should appear below without changing the top toggle height. */
.ir-wc-v07 .ir-wc-calendar-wide,
.ir-wc-v04 .ir-wc-calendar-wide,
.ir-wc-v07 .ir-wc-calendar-body,
.ir-wc-v04 .ir-wc-calendar-body {
  margin-top: 10px !important;
}

/* =========================================================
   2) Rooms: do not let Live card become a skinny column
   ========================================================= */

.rooms-v0-layout,
.rooms-v0-live-primary-shell,
.ecosystem-v0-layout--rooms.rooms-v0-layout {
  width: 100% !important;
  max-width: none !important;
  display: block !important;
  grid-template-columns: none !important;
}

/* Source-rendered Live card uses available panel width. */
.rooms-v0-layout > [data-live-rooms-panel],
.rooms-v0-live-primary-shell > [data-live-rooms-panel],
[data-live-rooms-panel].rooms-live-v1,
.rooms-live-v039h,
.rooms-live-v1 {
  width: min(640px, 100%) !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
}

/* Inside the right compact panel, use full width of the panel. */
.workspace-panel [data-live-rooms-panel],
.workspace-shell .workspace-panel [data-live-rooms-panel],
.workspace-panel[data-panel="rooms"] [data-live-rooms-panel],
.workspace-shell .workspace-panel[data-panel="rooms"] [data-live-rooms-panel] {
  width: 100% !important;
  max-width: none !important;
}

/* Header compactness in the right panel. */
.workspace-panel [data-live-rooms-panel] .rooms-live-v1__top,
.workspace-shell .workspace-panel [data-live-rooms-panel] .rooms-live-v1__top {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 10px !important;
}

.workspace-panel [data-live-rooms-panel] .rooms-live-v1__top p:not(.rooms-live-v1__eyebrow),
.workspace-shell .workspace-panel [data-live-rooms-panel] .rooms-live-v1__top p:not(.rooms-live-v1__eyebrow) {
  display: none !important;
}

/* If width allows, use two columns so it does not become long vertically. */
@container (min-width: 430px) {
  [data-live-rooms-panel] .rooms-live-v1__main {
    grid-template-columns: minmax(180px, 230px) minmax(0, 1fr) !important;
  }
}

/* Fallback without container queries. */
@media (min-width: 430px) {
  .workspace-panel [data-live-rooms-panel] .rooms-live-v1__main,
  .workspace-shell .workspace-panel [data-live-rooms-panel] .rooms-live-v1__main,
  .rooms-live-v039h .rooms-live-v1__main,
  [data-live-rooms-panel] .rooms-live-v1__main {
    grid-template-columns: minmax(180px, 230px) minmax(0, 1fr) !important;
    gap: 10px !important;
  }
}

.workspace-panel [data-live-rooms-panel] .rooms-live-v1__messages,
.workspace-shell .workspace-panel [data-live-rooms-panel] .rooms-live-v1__messages,
[data-live-rooms-panel] .rooms-live-v1__messages {
  min-height: 76px !important;
  max-height: 124px !important;
}

.workspace-panel [data-live-rooms-panel] .rooms-live-v1__compose textarea,
.workspace-shell .workspace-panel [data-live-rooms-panel] .rooms-live-v1__compose textarea,
[data-live-rooms-panel] .rooms-live-v1__compose textarea {
  min-height: 46px !important;
  max-height: 76px !important;
}

/* Keep send as a normal button, not a huge vertical block. */
.workspace-panel [data-live-rooms-panel] .rooms-live-v1__compose,
.workspace-shell .workspace-panel [data-live-rooms-panel] .rooms-live-v1__compose,
[data-live-rooms-panel] .rooms-live-v1__compose {
  grid-template-columns: minmax(0, 1fr) 86px !important;
  align-items: end !important;
}

.workspace-panel [data-live-rooms-panel] .rooms-live-v1__compose .ecosystem-v0-btn,
.workspace-shell .workspace-panel [data-live-rooms-panel] .rooms-live-v1__compose .ecosystem-v0-btn,
[data-live-rooms-panel] .rooms-live-v1__compose .ecosystem-v0-btn {
  width: 86px !important;
  min-width: 86px !important;
  max-width: 86px !important;
  height: 40px !important;
  min-height: 40px !important;
}

@media (max-width: 390px) {
  .workspace-panel [data-live-rooms-panel] .rooms-live-v1__main,
  .workspace-shell .workspace-panel [data-live-rooms-panel] .rooms-live-v1__main,
  [data-live-rooms-panel] .rooms-live-v1__main {
    grid-template-columns: 1fr !important;
  }

  .workspace-panel [data-live-rooms-panel] .rooms-live-v1__compose,
  .workspace-shell .workspace-panel [data-live-rooms-panel] .rooms-live-v1__compose,
  [data-live-rooms-panel] .rooms-live-v1__compose {
    grid-template-columns: 1fr !important;
  }

  .workspace-panel [data-live-rooms-panel] .rooms-live-v1__compose .ecosystem-v0-btn,
  .workspace-shell .workspace-panel [data-live-rooms-panel] .rooms-live-v1__compose .ecosystem-v0-btn,
  [data-live-rooms-panel] .rooms-live-v1__compose .ecosystem-v0-btn {
    width: 100% !important;
    max-width: none !important;
  }
}
`;

  function inject() {
    let style = document.getElementById(CSS_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = CSS_ID;
      document.head.appendChild(style);
    }

    if (style.textContent !== css) {
      style.textContent = css;
    }
  }

  function runSoon() {
    inject();
    setTimeout(inject, 80);
    setTimeout(inject, 300);
    setTimeout(inject, 900);
  }

  document.addEventListener('DOMContentLoaded', runSoon);
  document.addEventListener('click', runSoon, true);
  document.addEventListener('irg:language-changed', runSoon);
  window.addEventListener('resize', runSoon);

  if (document.readyState !== 'loading') runSoon();

  window.IRGEZTNEV039JStrongVisualPolish = { inject };
})();
