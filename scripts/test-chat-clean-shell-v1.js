'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const rooms = fs.readFileSync(path.join(root, 'src/modules/rooms/rooms-v0.js'), 'utf8');

assert.match(rooms, /mode === 'remote-online'/, 'online product mode must be explicit');
assert.match(rooms, /Разговоров пока нет/, 'clean pending shell must show no conversations');
assert.match(rooms, /Создать приглашение/, 'clean Chat shell must expose a real direct-invite action');
assert.match(rooms, /Присоединиться/, 'clean Chat shell must expose a real join action');
assert.match(rooms, /IRGEZTNE Workspace/, 'Chat shell must remain a Workspace module, not a separate product');
assert.match(rooms, /localLab \? tr\('Локальная лаборатория', 'Local lab'\) : tr\('Чат', 'Chat'\)/,
  'normal product title must be Chat and local lab must be explicitly named only as a lab');

// Internal historical/code identifiers may remain for compatibility, but the old
// technical codename must not be used in the product-facing template anymore.
const panelStart = rooms.indexOf('function panelHtml()');
const panelEnd = rooms.indexOf('function renderRooms()', panelStart);
assert.ok(panelStart >= 0 && panelEnd > panelStart, 'panelHtml source range unavailable');
const panel = rooms.slice(panelStart, panelEnd);
assert.equal(panel.includes('Зелёная молния'), false, 'technical codename leaked into product shell');
assert.equal(panel.includes('Green Lightning'), false, 'technical codename leaked into English product shell');
assert.equal(panel.includes('планируется'), false, 'non-working planned features leaked into Chat shell');
assert.equal(panel.includes('Audio calls are not available yet'), false, 'non-working call action leaked into Chat shell');
assert.equal(panel.includes('Video calls are not available yet'), false, 'non-working video action leaked into Chat shell');

console.log('CHAT CLEAN SHELL v1 PASS');
