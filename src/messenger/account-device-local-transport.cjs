'use strict';

const http = require('http');

const MAX_BODY_BYTES = 1024 * 1024;
const DEFAULT_HOST = '127.0.0.1';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function typedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function cleanText(value, max = 500) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function jsonReply(res, statusCode, value) {
  const body = JSON.stringify(value);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      throw typedError('REQUEST_TOO_LARGE', 'Request exceeds 1 MiB');
    }
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch (_) {
    throw typedError('INVALID_JSON', 'Request body is not valid JSON');
  }
}

function createAccountDeviceLocalTransport({
  enrollment,
  host = DEFAULT_HOST,
}) {
  if (!enrollment || typeof enrollment.publicStatus !== 'function') {
    throw new Error('Local enrollment transport requires enrollment owner');
  }
  if (typeof enrollment.acceptRequest !== 'function') {
    throw new Error('Local enrollment transport requires acceptRequest');
  }
  if (typeof enrollment.confirmJoined !== 'function') {
    throw new Error('Local enrollment transport requires confirmJoined');
  }

  let server = null;
  let address = null;
  let startedAt = '';
  let requests = 0;
  let approvals = 0;
  let confirmations = 0;
  let lastError = '';

  function publicStatus() {
    return {
      schema: 'irgeztne.account-device.transport.context.v1',
      mode: 'local-loopback-http',
      active: Boolean(server && address),
      host: address ? address.address : host,
      port: address ? Number(address.port) : 0,
      origin: address ? `http://${address.address}:${address.port}` : '',
      startedAt,
      requests,
      approvals,
      confirmations,
      lastError,
      scope: 'loopback-only',
      capabilities: {
        enrollmentRequest: true,
        enrollmentApproval: true,
        joinedReceipt: true,
        lanExposure: false,
        publicRelay: false,
      },
    };
  }

  async function handle(req, res) {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');

      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
        return jsonReply(res, 200, {
          ok: true,
          service: 'irgeztne-account-device-local-transport',
          status: publicStatus(),
        });
      }

      if (req.method === 'GET' && url.pathname === '/v1/enrollment/invite') {
        const status = enrollment.publicStatus({ includeCode: false });

        // Public invite exists for pending enrollment. A completed request can
        // still retry /request directly using its already saved invite/request.
        if (status.status !== 'pending' || !status.invite) {
          return jsonReply(res, 409, {
            ok: false,
            code: 'ENROLLMENT_NOT_PENDING',
            message: 'No active device enrollment invite',
          });
        }

        return jsonReply(res, 200, {
          ok: true,
          invite: clone(status.invite),
        });
      }

      if (req.method === 'POST' && url.pathname === '/v1/enrollment/request') {
        requests += 1;
        const body = await readJson(req);
        const approval = await enrollment.acceptRequest(body);
        approvals += 1;

        return jsonReply(res, 200, {
          ok: true,
          approval,
        });
      }

      if (req.method === 'POST' && url.pathname === '/v1/enrollment/confirm') {
        const body = await readJson(req);
        const result = enrollment.confirmJoined(body);
        confirmations += 1;

        jsonReply(res, 200, {
          ok: true,
          result,
        });

        // Receipt is terminal for this local enrollment listener.
        setImmediate(() => {
          void stop();
        });
        return;
      }

      return jsonReply(res, 404, {
        ok: false,
        code: 'NOT_FOUND',
        message: 'Route not found',
      });
    } catch (error) {
      lastError = cleanText(error && (error.code || error.message), 300);

      const code = cleanText(error && error.code, 100) || 'TRANSPORT_ERROR';
      const status = [
        'INVALID_JSON',
        'REQUEST_TOO_LARGE',
        'REQUEST_PROOF_INVALID',
        'ACCOUNT_MISMATCH',
        'CONVERSATION_MISMATCH',
        'INVITE_HASH_MISMATCH',
        'ENROLLMENT_ID_MISMATCH',
        'ENROLLMENT_REPLAY',
        'ENROLLMENT_CONFIRM_MISMATCH',
      ].includes(code)
        ? 400
        : code === 'ENROLLMENT_NOT_PENDING'
          ? 409
          : 500;

      return jsonReply(res, status, {
        ok: false,
        code,
        message: cleanText(error && error.message, 500) || 'Transport request failed',
      });
    }
  }

  async function start() {
    if (server && address) return publicStatus();

    server = http.createServer((req, res) => {
      void handle(req, res);
    });

    server.requestTimeout = 10_000;
    server.headersTimeout = 12_000;
    server.keepAliveTimeout = 2_000;
    server.maxHeadersCount = 40;

    await new Promise((resolve, reject) => {
      const onError = (error) => {
        server.removeListener('listening', onListening);
        reject(error);
      };
      const onListening = () => {
        server.removeListener('error', onError);
        resolve();
      };

      server.once('error', onError);
      server.once('listening', onListening);
      server.listen({
        host,
        port: 0,
        exclusive: true,
      });
    });

    address = server.address();
    if (!address || typeof address !== 'object') {
      throw new Error('Local transport failed to resolve listener address');
    }

    startedAt = new Date().toISOString();
    lastError = '';
    return publicStatus();
  }

  async function stop() {
    const current = server;
    server = null;
    address = null;

    if (!current) return publicStatus();

    await new Promise((resolve) => {
      let resolved = false;
      const finish = () => {
        if (resolved) return;
        resolved = true;
        resolve();
      };

      current.close(finish);
      const timer = setTimeout(finish, 1500);
      if (timer && typeof timer.unref === 'function') timer.unref();
    });

    return publicStatus();
  }

  return Object.freeze({
    start,
    stop,
    publicStatus,
  });
}

module.exports = {
  createAccountDeviceLocalTransport,
};
