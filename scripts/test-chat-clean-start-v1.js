'use strict';
const assert = require('assert');
const { createWorkspaceMessengerController } = require('../src/messenger/messenger-main.cjs');

const states = new Map();
let writes = 0;
const storage = {
  getModuleState(id, fallback) { return states.has(id) ? states.get(id) : fallback; },
  setModuleState(id, value) { writes += 1; states.set(id, JSON.parse(JSON.stringify(value))); return { ok: true }; },
  saveSecret() { throw new Error('unexpected secret write'); },
  readSecret() { return null; },
  clearSecret() { return { ok: true }; },
  hasSecret() { return false; }
};

(async () => {
  const controller = createWorkspaceMessengerController({
    app: { getPath() { return '/tmp/irgeztne-chat-clean-start-test'; } },
    runtimeDir: '/nonexistent/unused-while-remote-pending',
    storage,
    localLabEnabled: false,
    accountServiceGrantProvider: async () => ({ token: 'not-used' })
  });

  assert.equal(writes, 0, 'controller construction must not recreate old Chat state');
  const status = await controller.status();
  assert.equal(status.ok, true);
  assert.equal(status.mode, 'remote-pending');
  assert.equal(status.network, 'pending');
  assert.equal(writes, 0, 'status must not persist old lab state');

  const history = await controller.getConversation();
  assert.equal(history.ok, true);
  assert.equal(history.conversation.network, 'pending');
  assert.deepEqual(history.conversation.messages, []);
  assert.equal(writes, 0, 'history must not persist old lab state');

  await controller.close();
  console.log('CHAT CLEAN START v1 PASS');
})().catch((error) => {
  console.error(error && error.stack || error);
  process.exit(1);
});
