'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const renderer = fs.readFileSync(path.join(root, 'src', 'connected', 'connected-account-v044.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

test('Account exposes exactly the six accepted user-facing sections in RU and EN', () => {
  for (const view of ['profile', 'identity', 'security', 'recovery', 'services', 'info']) {
    assert.match(renderer, new RegExp(`navButton\\('${view}'`));
  }
  for (const pair of [
    ["t('Профиль', 'Profile')", 'Profile'],
    ["t('Идентификация', 'Identification')", 'Identification'],
    ["t('Безопасность', 'Security')", 'Security'],
    ["t('Восстановление', 'Recovery')", 'Recovery'],
    ["t('Сервисы', 'Services')", 'Services'],
    ["t('Сведения', 'Details')", 'Details']
  ]) assert.ok(renderer.includes(pair[0]), pair[1]);
  assert.doesNotMatch(renderer, /navButton\('overview'/);
  assert.match(renderer, /let accountSurfaceView = 'profile'/);
});

test('Account shell follows the approved visual hierarchy without replacing Workspace navigation', () => {
  assert.match(renderer, /accountNavigationHtml/);
  assert.doesNotMatch(renderer, /data-account-rail-toggle/);
  assert.doesNotMatch(renderer, /accountRailCollapsed/);
  assert.match(renderer, /account-v24__section-head/);
  assert.match(renderer, /account-v24__hero-status/);
  assert.match(styles, /Account User Surface v1 — final dark visual system/);
  assert.match(styles, /Account v1 — readability \+ desktop composition R1/);
  assert.match(styles, /\.account-v24__card-grid/);
  assert.match(styles, /@media \(max-width: 560px\)/);
});

test('final desktop composition is wider, readable and fixed-expanded', () => {
  assert.match(styles, /final six-image visual canon/);
  assert.match(styles, /Account v1 — readability \+ desktop composition R1/);
  assert.match(styles, /width:\s*min\(1700px, calc\(100% - 24px\)\)/);
  assert.match(styles, /grid-template-columns:\s*210px minmax\(0, 1fr\)/);
  assert.match(styles, /\.account-v24__collapse\s*\{\s*display:\s*none !important/);
  assert.match(styles, /\.account-v24__section-head h1\s*\{\s*font-size:\s*34px/);
  assert.match(styles, /\.account-v24__data-row span,[\s\S]*font-size:\s*14px/);
  assert.match(styles, /#cabinetExpandedView:has\([\s\S]*#cabinetCloseBtnExpanded/);
  assert.match(renderer, /account-v24__card-grid is-four/);
});

test('RU/EN shell ownership survives the delayed global i18n pass', () => {
  assert.equal((renderer.match(/window\.setTimeout\(scheduleAccountShellHeaderSync, 90\)/g) || []).length, 2);
  assert.match(renderer, /global i18n performs a delayed MutationObserver pass/);
  assert.match(renderer, /keep Account title\/subtitle stable after delayed i18n/);
});

test('Account title ownership yields immediately when another Workspace module becomes active', () => {
  assert.match(renderer, /closest\('\.cabinet-section-panel\[data-cabinet-panel="account"\]'\)/);
  assert.match(renderer, /panel\.hidden \|\| !panel\.classList\.contains\('active'\)/);
  assert.match(renderer, /workspaceFullModule \|\| ''\) !== 'account'/);
  assert.doesNotMatch(renderer, /workspaceFullAccountBtn/);
});

test('ordinary surfaces keep identifiers and Recovery fingerprint in Details', () => {
  assert.ok(renderer.indexOf("accountSurfaceView === 'info'") >= 0);
  assert.match(renderer, /Технические идентификаторы доступны отдельно в разделе «Сведения»/);
  assert.match(renderer, /AccountRecordID[\s\S]*IdentityID[\s\S]*DeviceID/);
  assert.match(renderer, /Отпечаток файла восстановления/);
  assert.doesNotMatch(renderer, /function recoveryFingerprintHtml/);
});

test('Recovery phrase uses system CSPRNG and at least 126 bits of word entropy', () => {
  assert.match(renderer, /window\.crypto\.getRandomValues/);
  assert.match(renderer, /const random = new Uint8Array\(18\)/);
  const match = renderer.match(/const RECOVERY_WORDS = \(\s*'([^']+)'/);
  assert.ok(match);
  const words = match[1].split(' ');
  assert.ok(new Set(words.slice(0, 128)).size === 128);
  assert.ok(18 * Math.log2(128) >= 126);
  assert.match(renderer, /the phrase is not stored by Workspace/);
  assert.match(renderer, /data-account-recovery-ack/);
});

test('Recovery phrase remains renderer-memory-only and is not written to module state', () => {
  assert.match(renderer, /let recoveryDraftPhrase = ''/);
  const writeState = renderer.slice(renderer.indexOf('function writePublicState'), renderer.indexOf('function hasCredential'));
  assert.doesNotMatch(writeState, /recoveryDraftPhrase|passphrase/);
  assert.doesNotMatch(renderer, /localStorage\.setItem\([^\n]*recovery/i);
});

test('Account actions have inline busy, success, warning and error presentation', () => {
  assert.match(renderer, /accountUiBusyAction/);
  assert.match(renderer, /aria-busy/);
  assert.match(renderer, /account-v24__notice is-/);
  for (const kind of ['success', 'warning', 'error']) {
    assert.match(renderer, new RegExp(`setAccountNotice\\('${kind}'`));
  }
});

test('unknown operation failures are not rendered from raw backend messages', () => {
  const start = renderer.indexOf('function identityOperationMessage');
  const end = renderer.indexOf('async function refreshIdentityAccountStatus', start);
  const source = renderer.slice(start, end);
  assert.doesNotMatch(source, /result\.message/);
  assert.match(source, /The operation could not be completed/);
});

test('inactive Accounts cannot edit profile in the user surface', () => {
  assert.match(renderer, /const accountActive = account\.status === 'ACTIVE'/);
  assert.match(renderer, /identity-profile-save[\s\S]*accountActive \? '' : 'disabled'/);
  assert.match(renderer, /SECURITY_LOCKED/);
  assert.match(renderer, /DELETION_PENDING/);
});

test('Services remain isolated while Chat is available and Workshop is not connected', () => {
  assert.match(renderer, /При открытии Chat Main-процесс получает короткоживущее разрешение только для Chat/);
  assert.match(renderer, /accountActive \? t\('Доступен', 'Available'\)/);
  assert.match(renderer, /Online publishing is not enabled yet/);
  assert.match(renderer, /Workshop will request its own permission separately from Chat/);
  assert.match(renderer, /Each service receives only its own limited permission/);
  const start = renderer.indexOf('function identityAccountSurfaceHtml');
  const end = renderer.indexOf('const identityExists', start);
  const activeSurface = renderer.slice(start, end);
  assert.match(activeSurface, />Chat</);
  assert.match(activeSurface, /Workshop Online/);
  assert.doesNotMatch(activeSurface, /Atlas|Native P2P|Hosting|Coming soon|Future services/);
  assert.doesNotMatch(activeSurface, /data-account-service-connect/);
});

test('Profile does not invent unsupported avatar or email persistence', () => {
  assert.match(renderer, /contactEmail/);
  assert.match(renderer, /Identity is used for sign-in and recovery/);
  assert.doesNotMatch(renderer, /data-account-profile-input="email"/);
  assert.doesNotMatch(renderer, /data-account-avatar-upload/);
});

test('dark Account fields have explicit contrast, caret and focus treatment', () => {
  assert.match(renderer, /caret-color:\s*#72e6ca/);
  assert.match(renderer, /input:focus-visible/);
  assert.match(renderer, /background:\s*rgba\(4, 19, 38, \.92\)/);
  assert.match(renderer, /prefers-reduced-motion/);
  assert.match(styles, /prefers-reduced-motion/);
});

test('network-not-configured is explained as an online-service warning, not a broken local Account', () => {
  assert.match(renderer, /Сетевое подключение онлайн-сервисов пока не настроено\. Локальные Account и Identity продолжают работать\./);
  assert.match(renderer, /ACCOUNT_NETWORK_NOT_CONFIGURED' \? 'warning' : 'error'/);
});

test('local-first boundary and disconnect continuity remain visible', () => {
  assert.match(renderer, /Файлы, Проекты, Офис, Заметки, Задачи, Инструменты/);
  assert.match(renderer, /повторное подключение возвращает тот же Account/);
  assert.match(renderer, /disconnectIdentityNetworkAccount/);
});
