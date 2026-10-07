'use strict';

const MAX_RESPONSE_BYTES = 1024 * 1024;

function typedError(code, message, details = null) {
  const error = new Error(message);
  error.code = code;
  if (details) error.details = details;
  return error;
}

function cleanBase(value) {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  if (!raw) throw typedError('CHAT_SERVICE_NOT_CONFIGURED', 'Chat service is not configured.');
  let parsed;
  try { parsed = new URL(raw); }
  catch (_) { throw typedError('CHAT_SERVICE_URL_INVALID', 'Chat service URL is invalid.'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw typedError('CHAT_SERVICE_URL_INVALID', 'Chat service URL must be an HTTPS origin.');
  }
  return parsed.origin + parsed.pathname.replace(/\/+$/, '');
}

function cleanId(value, label) {
  const id = String(value || '').trim();
  if (!/^[A-Za-z0-9._:-]{8,180}$/.test(id)) {
    throw typedError('CHAT_ID_INVALID', `${label} is invalid.`);
  }
  return id;
}

function cleanInvite(value) {
  const token = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(token)) {
    throw typedError('CHAT_INVITE_INVALID', 'Conversation invite is invalid.');
  }
  return token;
}

function cleanOpaque(value, label, maximum = 1024 * 1024) {
  const data = String(value || '').trim();
  if (!data || !/^[A-Za-z0-9_-]+$/.test(data)) {
    throw typedError('CHAT_OPAQUE_INVALID', `${label} is invalid.`);
  }
  const bytes = Math.floor((data.length * 3) / 4);
  if (bytes < 1 || bytes > maximum) {
    throw typedError('CHAT_OPAQUE_LIMIT', `${label} exceeds the allowed size.`);
  }
  return data;
}

async function responseJson(response) {
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
    throw typedError('CHAT_RESPONSE_LIMIT', 'Chat service response is too large.');
  }
  if (!text) return null;
  try { return JSON.parse(text); }
  catch (_) { throw typedError('CHAT_RESPONSE_INVALID', 'Chat service returned invalid JSON.'); }
}

function createChatServiceClient({ baseUrl, fetchImpl, grantProvider }) {
  if (typeof fetchImpl !== 'function') throw new Error('Chat fetch implementation is required');
  if (typeof grantProvider !== 'function') throw new Error('Chat grant provider is required');
  const base = cleanBase(baseUrl);
  let requestTail = Promise.resolve();

  async function performRequest(pathname, { method = 'GET', body = null } = {}) {
    const grant = await grantProvider();
    const token = String(grant && grant.token || '');
    if (!/^[A-Za-z0-9_-]{20,}$/.test(token) || String(grant && grant.service || '') !== 'CHAT') {
      throw typedError('CHAT_AUTH_UNAVAILABLE', 'Chat authorization is unavailable.');
    }

    const headers = {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Cache-Control': 'no-cache'
    };
    if (body !== null) headers['Content-Type'] = 'application/json';

    let response;
    try {
      response = await fetchImpl(`${base}${pathname}`, {
        method,
        headers,
        body: body === null ? undefined : JSON.stringify(body)
      });
    } catch (_) {
      throw typedError('CHAT_NETWORK_UNAVAILABLE', 'Chat service is unavailable.');
    }

    const data = await responseJson(response);
    if (!response.ok || data?.ok !== true) {
      const code = String(data?.error?.code || (response.status === 401 ? 'CHAT_AUTH_INVALID' : 'CHAT_REQUEST_FAILED'));
      const publicMessage = response.status >= 500
        ? 'Chat service is temporarily unavailable.'
        : String(data?.error?.message || 'Chat request failed.');
      throw typedError(code, publicMessage, { status: response.status });
    }
    return data;
  }

  // Identity-backed Account grants rotate when a new grant is issued. Keep the
  // grant acquisition + authenticated request pair serialized so overlapping
  // UI refreshes cannot revoke a request that is still in flight.
  function request(pathname, options = {}) {
    const operation = requestTail.then(() => performRequest(pathname, options));
    requestTail = operation.catch(() => undefined);
    return operation;
  }

  return Object.freeze({
    async listConversations() {
      const data = await request('/v1/conversations');
      return Array.isArray(data.conversations) ? data.conversations : [];
    },

    async createInvite() {
      const data = await request('/v1/conversations/invites', { method: 'POST', body: {} });
      const invite = data.invite || {};
      return Object.freeze({
        conversationId: cleanId(invite.conversation_id, 'Conversation ID'),
        token: cleanInvite(invite.token),
        expiresAt: Number(invite.expires_at || 0)
      });
    },

    async joinInvite(inviteToken, keyPackageB64) {
      const data = await request('/v1/conversations/join', {
        method: 'POST',
        body: {
          invite_token: cleanInvite(inviteToken),
          key_package_b64: cleanOpaque(keyPackageB64, 'MLS key package', 128 * 1024)
        }
      });
      return Object.freeze({
        conversationId: cleanId(data?.conversation?.conversation_id, 'Conversation ID'),
        state: String(data?.conversation?.state || '')
      });
    },

    async getHandshake(conversationId) {
      const id = cleanId(conversationId, 'Conversation ID');
      const data = await request(`/v1/conversations/handshake?conversation_id=${encodeURIComponent(id)}`);
      const handshake = data.handshake || {};
      return Object.freeze({
        conversationId: id,
        role: String(handshake.role || ''),
        keyPackageB64: handshake.key_package_b64 ? cleanOpaque(handshake.key_package_b64, 'MLS key package', 128 * 1024) : null,
        welcomeB64: handshake.welcome_b64 ? cleanOpaque(handshake.welcome_b64, 'MLS welcome', 512 * 1024) : null,
        ready: Boolean(handshake.ready)
      });
    },

    async publishWelcome(conversationId, welcomeB64) {
      const id = cleanId(conversationId, 'Conversation ID');
      const data = await request('/v1/conversations/handshake', {
        method: 'POST',
        body: {
          conversation_id: id,
          welcome_b64: cleanOpaque(welcomeB64, 'MLS welcome', 512 * 1024)
        }
      });
      return Boolean(data?.handshake?.ready);
    },

    async postMessage(conversationId, messageId, envelopeB64) {
      const data = await request('/v1/messages', {
        method: 'POST',
        body: {
          conversation_id: cleanId(conversationId, 'Conversation ID'),
          message_id: cleanId(messageId, 'Message ID'),
          envelope_b64: cleanOpaque(envelopeB64, 'Encrypted message envelope')
        }
      });
      return Object.freeze({
        duplicate: Boolean(data.duplicate),
        seq: Number(data?.message?.seq || 0),
        createdAt: Number(data?.message?.created_at || 0)
      });
    },

    async getMessages(conversationId, afterSeq = 0) {
      const id = cleanId(conversationId, 'Conversation ID');
      const after = Math.max(0, Number.parseInt(String(afterSeq || 0), 10) || 0);
      const data = await request(`/v1/messages?conversation_id=${encodeURIComponent(id)}&after_seq=${after}&limit=200`);
      return Array.isArray(data.messages) ? data.messages : [];
    }
  });
}

module.exports = { createChatServiceClient, __test: { cleanBase, cleanId, cleanInvite, cleanOpaque } };
