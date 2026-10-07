const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
function ok(cond, msg) { if (!cond) { console.error('FAIL:', msg); process.exitCode = 1; } else console.log('PASS:', msg); }
const account = read('src/connected/connected-account-v044.js');
const preload = read('preload.js');
const main = read('main.js');
const shell = read('src/legacy-shell.js');
const index = read('index.html');
ok(!index.includes('irgeztne-account-config-v1.js'), 'legacy Supabase Account config is not loaded');
ok(!/supabase/i.test(account), 'renderer Account owner has no Supabase runtime');
ok(!/data-account-auth-form="signin"|data-account-auth-form="signup"|remember_login/.test(account), 'Electron renderer no longer owns email/password auth forms');
ok(account.includes('beginDesktopConnection') && account.includes('completeDesktopConnection'), 'Workspace Account uses desktop grant connection flow');
ok(account.includes('Turnstile and browser checks do not run inside Electron'), 'renderer documents hosted browser security boundary');
ok(preload.includes("contextBridge.exposeInMainWorld('irgeztneAccount'"), 'narrow Account bridge is exposed from preload');
ok(!/serviceGrant|desktopGrant|privateJwk/.test(preload.slice(preload.indexOf("contextBridge.exposeInMainWorld('irgeztneAccount'"), preload.indexOf('// IRGEZTNE Green Lightning'))), 'renderer Account bridge exposes no master/device secret');
ok(main.includes('createAccountDesktopController') && main.includes('safeStorage'), 'Main owns Account desktop controller and OS protected storage');
ok(
  shell.includes("showCabinetSection('account')") &&
  shell.includes("'account'\n    ].includes(state.activeCabinetSection)") &&
  !shell.includes('workspaceFullAccountBtn'),
  'Account opens as a full Workspace surface without adding a visible global-nav module'
);
ok(
  account.includes("title.textContent = t('Аккаунт', 'Account')") &&
  account.includes('syncAccountShellHeader') &&
  account.includes('scheduleAccountShellHeaderSync') &&
  account.includes("panel.classList.contains('active')") &&
  account.includes("workspaceFullModule || '') !== 'account'"),
  'Account owns its module title in RU/EN only while the Account shell route is active'
);
ok(account.includes('Workspace работает без Account'), 'local-first Account boundary remains explicit');
ok(account.includes('Chat') && account.includes('Workshop'), 'connected service boundary names Chat and Workshop');
if (process.exitCode) process.exit(process.exitCode); else console.log('ACCOUNT FOUNDATION v24 STATIC PASS');
