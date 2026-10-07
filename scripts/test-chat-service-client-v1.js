'use strict';

const assert = require('assert');
const { createChatServiceClient } = require('../src/messenger/chat-service-client.cjs');

assert.throws(
  () => createChatServiceClient({
    baseUrl: 'http://chat.example.test',
    fetchImpl: async () => new Response('{}'),
    grantProvider: async () => ({ token: 'grant-abcdefghijklmnopqrstuvwxyz', service: 'CHAT' })
  }),
  (error) => error && error.code === 'CHAT_SERVICE_URL_INVALID'
);

(async () => {
  let active = 0;
  let maximumActive = 0;
  let grants = 0;
  const calls = [];
  const client = createChatServiceClient({
    baseUrl: 'https://chat.example.test',
    grantProvider: async () => ({
      token: `grant-${String(++grants).padStart(24, '0')}`,
      service: 'CHAT'
    }),
    fetchImpl: async (url, init) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      calls.push({ url, authorization: init.headers.Authorization });
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      return new Response(JSON.stringify({ ok: true, conversations: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  });

  await Promise.all([
    client.listConversations(),
    client.listConversations(),
    client.listConversations()
  ]);

  assert.equal(maximumActive, 1, 'rotating Chat grants must never overlap in flight');
  assert.equal(grants, 3);
  assert.equal(new Set(calls.map((call) => call.authorization)).size, 3);
  assert.equal(calls.every((call) => call.url === 'https://chat.example.test/v1/conversations'), true);
  console.log('CHAT SERVICE CLIENT v1 PASS — HTTPS boundary and serialized rotating grants');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
