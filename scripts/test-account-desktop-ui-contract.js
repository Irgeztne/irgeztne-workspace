'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const preload = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const connected = fs.readFileSync(path.join(root, 'src', 'connected', 'connected-account-v044.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

test('renderer receives a narrow Account bridge and no direct persistent Account secret capability', () => {
  const bridgeStart = preload.indexOf("contextBridge.exposeInMainWorld('irgeztneAccount'");
  assert.ok(bridgeStart >= 0);
  const bridgeEnd = preload.indexOf("// IRGEZTNE Green Lightning", bridgeStart);
  const bridge = preload.slice(bridgeStart, bridgeEnd);
  for (const method of ['getStatus', 'startConnection', 'openAuthorization', 'completeConnection', 'cancelConnection', 'logout']) {
    assert.match(bridge, new RegExp(method));
  }
  assert.doesNotMatch(bridge, /sessionToken|desktopGrant|privateJwk|pkce_verifier|accessToken/);
});

test('Main owns Account desktop controller and guards every Account IPC with trusted sender validation', () => {
  assert.match(main, /createAccountDesktopController/);
  assert.match(main, /registerAccountDesktopIpc\(\{[\s\S]*assertTrustedSender/);
  assert.match(main, /safeStorage/);
  assert.match(main, /https:\/\/account\.irgeztne\.com/);
});

test('Workspace Account Center uses the v24 vertical native surface and browser handoff', () => {
  assert.match(connected, /account-v24__rail/);
  assert.match(connected, /data-account-surface-view/);
  assert.match(connected, /desktop-connect/);
  assert.match(connected, /Turnstile and browser checks do not run inside Electron/);
  assert.match(styles, /\.account-v24\s*\{[\s\S]*grid-template-columns:\s*218px minmax\(0, 1fr\)/);
  assert.match(styles, /\.account-v24__nav\s*\{[\s\S]*display:\s*grid/);
  assert.doesNotMatch(connected, /supabase/i);
  // Recovery passphrase fields legitimately use the standard
  // current-password/new-password autocomplete hints. They are not
  // Account login/password authentication.
  assert.doesNotMatch(connected, /remember_login/);
  assert.doesNotMatch(connected, /account[-_ ]?(?:login|auth)[-_ ]?password/i);
});

test('Account Trusted Device and Messenger MLS device are visibly kept as separate roles', () => {
  assert.match(connected, /Trusted device/);
  assert.match(connected, /Chat \/ MLS/);
  assert.match(connected, /отдельным от Trusted Device Account/);
  assert.match(connected, /Keys are never reused across these roles/);
});

test('new connected state is driven by Main Account status rather than legacy renderer access token', () => {
  assert.match(connected, /if \(bridge\) return Boolean\(accountStatus\(\) && accountStatus\(\)\.connected\)/);
  assert.match(connected, /refreshAccountStatus/);
  assert.match(connected, /beginDesktopConnection/);
});


test('service grants stay Main-owned and are not exposed as a generic Renderer token bridge', () => {
  const accountBridgeStart = preload.indexOf("contextBridge.exposeInMainWorld('irgeztneAccount'");
  const accountBridgeEnd = preload.indexOf('// IRGEZTNE Green Lightning', accountBridgeStart);
  const accountBridge = preload.slice(accountBridgeStart, accountBridgeEnd);
  assert.doesNotMatch(accountBridge, /serviceGrant|chatGrant|workshopGrant|services\/grant/);
  assert.doesNotMatch(preload, /account:service:|irgeztneServices/);

  assert.match(main, /acquireServiceGrantForMain\('CHAT'\)/);
  assert.match(main, /accountServiceGrantProvider/);
});

test('Messenger has a Main-only Chat grant hook and does not register it as renderer IPC', () => {
  const messenger = fs.readFileSync(path.join(root, 'src', 'messenger', 'messenger-main.cjs'), 'utf8');
  assert.match(messenger, /accountServiceGrantProvider = null/);
  assert.match(messenger, /acquireAccountServiceAuthorizationForTransport/);
  const ipcStart = messenger.indexOf('function registerWorkspaceMessengerIpc');
  const ipcSection = messenger.slice(ipcStart);
  assert.doesNotMatch(ipcSection, /acquireAccountServiceAuthorizationForTransport/);
  assert.doesNotMatch(ipcSection, /service-grant|serviceGrant/);
});
