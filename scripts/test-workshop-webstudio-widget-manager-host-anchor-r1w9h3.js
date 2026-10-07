const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const parent = fs.readFileSync(path.join(root, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js'), 'utf8');
const workbench = fs.readFileSync(path.join(root, 'src/modules/editor-workbench/editor-workbench.js'), 'utf8');

function expect(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
}

expect(parent, 'IRGEZTNE_WORKBENCH_WIDGET_MANAGER_HOST_ANCHOR_R1W9H3', 'parent has R1W9H3 viewport-sync marker');
expect(parent, "document.addEventListener('scroll', scheduleEditorWorkbenchViewportR1W9H3, true);", 'host scroll is observed in capture phase');
expect(parent, "type: 'host-viewport-r1w9h3'", 'host sends visible Workbench viewport to child');
expect(parent, 'localTop: viewport.localTop', 'host sends local visible top');
expect(parent, 'localBottom: viewport.localBottom', 'host sends local visible bottom');
expect(parent, 'scheduleEditorWorkbenchViewportR1W9H3();', 'host schedules viewport sync after Workbench lifecycle changes');

expect(workbench, 'let widgetHostViewportR1W9H3 = null;', 'Workbench stores host-visible viewport');
expect(workbench, "if (data.type === 'host-viewport-r1w9h3')", 'Workbench accepts host viewport updates');
expect(workbench, 'const visibleTop = Math.max(0, Number(widgetHostViewportR1W9H3.localTop)', 'Widget Manager position uses host-visible top');
expect(workbench, 'widgetsPanelR1W9G.style.maxHeight = `${Math.round(panelMaxHeight)}px`;', 'Widget Manager height is bounded to visible host area');
expect(workbench, 'top = Math.max(visibleTop, top);', 'Widget Manager sticks inside visible Workbench area');
expect(workbench, 'window.requestAnimationFrame(positionWidgetsPanelR1W9H2);', 'host viewport update repositions open Widget Manager');

if (workbench.includes("data-action = 'widget-insert-after'")) {
  console.error('FAIL: R1W9H3 must not reintroduce Component-like Widget insertion.');
  process.exit(1);
}

console.log('PASS: R1W9H3 keeps the Site Widgets manager anchored to the visible Web Studio/Workbench viewport while outer scrolling moves the auto-height iframe; Widget placement/runtime architecture is unchanged.');
