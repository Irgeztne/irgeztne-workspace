import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const RUNTIME = path.join(PROJECT_ROOT, 'src', 'messenger', 'native-runtime')
const CLIENT_PATH = path.join(RUNTIME, 'secure-local-service-client.mjs')
const BINARY = path.join(
  RUNTIME,
  `irgeztne-green-lightning-secure-local-service-v04n${process.platform === 'win32' ? '.exe' : ''}`
)

const LAB_ROOT = path.join(
  os.homedir(),
  'Загрузки',
  '_IRGEZTNE_LABS',
  'messenger-network-relay-v03'
)
const DATA_ROOT = path.join(LAB_ROOT, 'endpoints')
const PRIVATE_A1 = path.join(LAB_ROOT, 'private-a1')
const PRIVATE_A2 = path.join(LAB_ROOT, 'private-a2')
const REGISTRY = path.join(PRIVATE_A1, 'registry.json')
const RECEIPT = path.join(PRIVATE_A2, 'receipt.json')
const PENDING_A2 = path.join(PRIVATE_A2, 'pending-requests')
const ACCOUNT_ID = 'account-a'
const CONVERSATION_ID = 'e3-network-group-v03'
const KEYRING_PREFIX = 'com.irgeztne.green-lightning.sandbox.network-relay.v03'
const TTL_MS = 5 * 60 * 1000

const A1 = {
  accountId: ACCOUNT_ID,
  deviceId: 'device-a1',
  label: 'Primary Workspace',
  identity: 'sandbox/account-a/device-a1-e3',
  keyringService: `${KEYRING_PREFIX}.a1`,
}
const A2 = {
  accountId: ACCOUNT_ID,
  deviceId: 'device-a2',
  label: 'Second Workspace',
  identity: 'sandbox/account-a/device-a2-e3',
  keyringService: `${KEYRING_PREFIX}.a2`,
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
}
function writeJson(file, value) {
  ensureDir(path.dirname(file))
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 })
  try { fs.chmodSync(file, 0o600) } catch {}
}
function readJson(file, fallback = null) {
  if (!fs.existsSync(file)) return fallback
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}
function now() {
  return new Date().toISOString()
}
function err(code, message) {
  const e = new Error(message)
  e.code = code
  return e
}
function assert(v, m) {
  if (!v) throw new Error(m)
}
function sha256Json(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}
function proofKey(code) {
  return crypto.createHmac('sha256', 'IRGEZTNE-E3-PAIRING-v1').update(String(code)).digest()
}
function hmac(key, value) {
  return crypto.createHmac('sha256', key).update(JSON.stringify(value)).digest('hex')
}
function safeHex(a, b) {
  try {
    const aa = Buffer.from(String(a || ''), 'hex')
    const bb = Buffer.from(String(b || ''), 'hex')
    return aa.length > 0 && aa.length === bb.length && crypto.timingSafeEqual(aa, bb)
  } catch {
    return false
  }
}
function canonicalInvite(value) {
  return {
    schema: value.schema,
    version: value.version,
    enrollmentId: value.enrollmentId,
    accountId: value.accountId,
    conversationId: value.conversationId,
    inviterDeviceId: value.inviterDeviceId,
    challenge: value.challenge,
    expiresAt: value.expiresAt,
  }
}
function canonicalRequest(value) {
  return {
    schema: value.schema,
    version: value.version,
    requestId: value.requestId,
    enrollmentId: value.enrollmentId,
    inviteHash: value.inviteHash,
    accountId: value.accountId,
    conversationId: value.conversationId,
    deviceId: value.deviceId,
    deviceLabel: value.deviceLabel,
    memberIdentity: value.memberIdentity,
    keyPackageHex: value.keyPackageHex,
  }
}
function canonicalApproval(value) {
  return {
    schema: value.schema,
    version: value.version,
    result: value.result,
    requestId: value.requestId,
    enrollmentId: value.enrollmentId,
    requestHash: value.requestHash,
    accountId: value.accountId,
    conversationId: value.conversationId,
    deviceId: value.deviceId,
    memberIdentity: value.memberIdentity,
    welcomeHex: value.welcomeHex,
    commitHex: value.commitHex,
    epoch: value.epoch,
    members: value.members,
  }
}
async function relayFetch(url, options = {}, attempts = 8) {
  let lastError = null

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(url, options)
    } catch (error) {
      lastError = error
      if (attempt >= attempts) break
      await new Promise((resolve) => setTimeout(resolve, Math.min(240, 35 * attempt)))
    }
  }

  const method = String(options?.method || 'GET').toUpperCase()
  const cause = String(lastError?.cause?.code || lastError?.cause?.message || lastError?.message || lastError || '')
  throw err('RELAY_FETCH_FAILED', `relay ${method} ${url} failed after ${attempts} attempts: ${cause}`)
}

async function post(relay, mailbox, payload) {
  const url = `${relay}/mailbox/${encodeURIComponent(mailbox)}`
  const response = await relayFetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'connection': 'close' },
    body: JSON.stringify(payload),
  })
  const body = await response.json()
  if (!response.ok || !body.ok) throw new Error(`relay POST failed: ${JSON.stringify(body)}`)
  return body
}
async function list(relay, mailbox, after = 0) {
  const url = `${relay}/mailbox/${encodeURIComponent(mailbox)}?after=${encodeURIComponent(String(after))}`
  const response = await relayFetch(
    url,
    { headers: { 'cache-control': 'no-store', 'connection': 'close' } }
  )
  const body = await response.json()
  if (!response.ok || !body.ok) throw new Error(`relay GET failed: ${JSON.stringify(body)}`)
  return body.items || []
}
async function waitFor(relay, mailbox, predicate, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs
  let after = 0
  while (Date.now() < deadline) {
    const items = await list(relay, mailbox, after)
    for (const item of items) {
      after = Math.max(after, Number(item.seq || 0))
      if (predicate(item.payload)) return item
    }
    await new Promise((resolve) => setTimeout(resolve, 60))
  }
  throw new Error(`timeout waiting for ${mailbox}`)
}
async function loadNative() {
  const mod = await import(pathToFileURL(CLIENT_PATH).href)
  assert(typeof mod.SecureLocalServiceClient === 'function', 'SecureLocalServiceClient unavailable')
  return mod
}
function makeClient(Client, spec) {
  return new Client({
    dataDir: path.join(DATA_ROOT, spec.deviceId),
    identity: spec.identity,
    keyringService: spec.keyringService,
    binaryPath: BINARY,
  })
}
function defaultRegistry() {
  return {
    schema: 'irgeztne.e3.registry.v1',
    accountId: ACCOUNT_ID,
    conversationId: CONVERSATION_ID,
    devices: [{
      deviceId: A1.deviceId,
      memberIdentity: A1.identity,
      status: 'active',
      current: true,
      createdAt: now(),
    }],
    completed: {},
  }
}

async function reset() {
  const mod = await loadNative()
  for (const spec of [A1, A2]) {
    try {
      mod.deleteRootKey({ keyringService: spec.keyringService, binaryPath: BINARY })
    } catch {}
  }
  try { fs.rmSync(LAB_ROOT, { recursive: true, force: true }) } catch {}
  ensureDir(PRIVATE_A1)
  ensureDir(PRIVATE_A2)
  ensureDir(PENDING_A2)
  ensureDir(DATA_ROOT)
  writeJson(REGISTRY, defaultRegistry())
  console.log(JSON.stringify({ ok: true }))
}

async function a1Server(relay) {
  const mod = await loadNative()
  const client = makeClient(mod.SecureLocalServiceClient, A1)
  let running = true
  let cursor = 0
  let session = null

  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => { running = false })
  }

  try {
    await client.start()
    const ping = await client.ping()
    assert(ping?.service_version === '0.4N-P21', `Expected P21; got ${ping?.service_version}`)
    await client.createGroup(CONVERSATION_ID)

    const code = crypto.randomBytes(32).toString('base64url')
    session = {
      enrollmentId: crypto.randomUUID(),
      challenge: crypto.randomBytes(24).toString('base64url'),
      code,
      expiresAtMs: Date.now() + TTL_MS,
    }
    const invite = {
      schema: 'irgeztne.enrollment.invite.v1',
      version: 1,
      enrollmentId: session.enrollmentId,
      accountId: ACCOUNT_ID,
      conversationId: CONVERSATION_ID,
      inviterDeviceId: A1.deviceId,
      challenge: session.challenge,
      expiresAt: new Date(session.expiresAtMs).toISOString(),
    }
    session.invite = invite
    session.inviteHash = sha256Json(canonicalInvite(invite))
    session.key = proofKey(code)

    await post(relay, 'to-a2', invite)

    console.log(`E3_A1_READY:${JSON.stringify({
      ok: true,
      enrollmentId: session.enrollmentId,
      code,
    })}`)

    while (running) {
      const items = await list(relay, 'to-a1', cursor)
      for (const item of items) {
        cursor = Math.max(cursor, Number(item.seq || 0))
        const request = item.payload
        if (request?.schema !== 'irgeztne.enrollment.request.v1') continue

        let response
        try {
          if (Date.now() > session.expiresAtMs) throw err('ENROLLMENT_EXPIRED', 'Enrollment expired')
          if (request.enrollmentId !== session.enrollmentId) throw err('ENROLLMENT_ID_MISMATCH', 'Enrollment id mismatch')
          if (request.inviteHash !== session.inviteHash) throw err('INVITE_HASH_MISMATCH', 'Invite was modified')
          if (request.accountId !== ACCOUNT_ID) throw err('ACCOUNT_MISMATCH', 'Account mismatch')
          if (request.conversationId !== CONVERSATION_ID) throw err('CONVERSATION_MISMATCH', 'Conversation mismatch')

          const expected = hmac(session.key, canonicalRequest(request))
          if (!safeHex(request.proof, expected)) {
            throw err('REQUEST_PROOF_INVALID', 'Request proof invalid')
          }

          const registry = readJson(REGISTRY, defaultRegistry())
          const requestHash = sha256Json(canonicalRequest(request))
          const completed = registry.completed[session.enrollmentId]

          if (completed) {
            if (completed.requestHash !== requestHash) {
              throw err('ENROLLMENT_REPLAY', 'Enrollment replay content mismatch')
            }
            // Network retry semantics: resend the exact immutable approval,
            // never mutate MLS again.
            response = completed.approval
          } else {
            const existing = registry.devices.find((d) => d.deviceId === request.deviceId)
            if (existing && existing.memberIdentity !== request.memberIdentity) {
              throw err('DEVICE_ID_CONFLICT', 'deviceId belongs to another identity')
            }

            const add = await client.addMember(CONVERSATION_ID, request.keyPackageHex)
            assert(add?.welcome_hex && add?.commit_hex, 'MLS add missing Welcome/Commit')

            const approval = {
              schema: 'irgeztne.enrollment.approval.v1',
              version: 1,
              result: 'ENROLLED',
              requestId: request.requestId,
              enrollmentId: session.enrollmentId,
              requestHash,
              accountId: ACCOUNT_ID,
              conversationId: CONVERSATION_ID,
              deviceId: request.deviceId,
              memberIdentity: request.memberIdentity,
              welcomeHex: add.welcome_hex,
              commitHex: add.commit_hex,
              epoch: Number(add.epoch),
              members: Number(add.members),
            }
            approval.proof = hmac(session.key, canonicalApproval(approval))

            registry.devices.push({
              deviceId: request.deviceId,
              memberIdentity: request.memberIdentity,
              status: 'active',
              current: false,
              createdAt: now(),
            })
            registry.completed[session.enrollmentId] = {
              requestHash,
              approval,
              completedAt: now(),
            }
            writeJson(REGISTRY, registry)
            response = approval
          }
        } catch (error) {
          response = {
            schema: 'irgeztne.enrollment.rejection.v1',
            version: 1,
            result: 'REJECTED',
            requestId: request?.requestId || '',
            enrollmentId: request?.enrollmentId || session.enrollmentId,
            code: String(error?.code || 'ENROLLMENT_ERROR'),
            message: String(error?.message || error || ''),
          }
        }

        await post(relay, 'to-a2', response)
      }

      await new Promise((resolve) => setTimeout(resolve, 60))
    }
  } finally {
    await client.close()
  }
}

async function a2SendRequest(relay, code, requestId) {
  const inviteItem = await waitFor(
    relay,
    'to-a2',
    (payload) => payload?.schema === 'irgeztne.enrollment.invite.v1'
  )
  const invite = inviteItem.payload
  ensureDir(PENDING_A2)

  // Network retry contract:
  // one requestId owns one immutable enrollment request/KeyPackage.
  // A retry MUST resend the exact same serialized request rather than minting
  // a new KeyPackage and accidentally becoming a different enrollment attempt.
  const pendingFile = path.join(
    PENDING_A2,
    `${String(requestId).replace(/[^a-zA-Z0-9._-]/g, '_')}.json`
  )

  let request
  let reused = false

  if (fs.existsSync(pendingFile)) {
    request = readJson(pendingFile)

    if (
      request?.schema !== 'irgeztne.enrollment.request.v1' ||
      request?.version !== 1 ||
      request?.requestId !== requestId ||
      request?.enrollmentId !== invite.enrollmentId ||
      request?.inviteHash !== sha256Json(canonicalInvite(invite)) ||
      request?.deviceId !== A2.deviceId ||
      request?.memberIdentity !== A2.identity
    ) {
      throw err('PENDING_REQUEST_CONFLICT', 'Stored pending enrollment request does not match current invite/device')
    }

    const expected = hmac(proofKey(code), canonicalRequest(request))
    if (!safeHex(request.proof, expected)) {
      throw err('PENDING_REQUEST_CODE_MISMATCH', 'Stored pending request was created with a different pairing code')
    }

    reused = true
  } else {
    const mod = await loadNative()
    const client = makeClient(mod.SecureLocalServiceClient, A2)
    try {
      await client.start()
      const kp = await client.keyPackage()
      assert(kp?.key_package_hex, 'A2 KeyPackage missing')

      request = {
        schema: 'irgeztne.enrollment.request.v1',
        version: 1,
        requestId,
        enrollmentId: invite.enrollmentId,
        inviteHash: sha256Json(canonicalInvite(invite)),
        accountId: ACCOUNT_ID,
        conversationId: invite.conversationId,
        deviceId: A2.deviceId,
        deviceLabel: A2.label,
        memberIdentity: A2.identity,
        keyPackageHex: kp.key_package_hex,
      }
      request.proof = hmac(proofKey(code), canonicalRequest(request))
      writeJson(pendingFile, request)
    } finally {
      await client.close()
    }
  }

  const sent = await post(relay, 'to-a1', request)
  console.log(JSON.stringify({
    ok: true,
    seq: sent.seq,
    request,
    reusedPendingRequest: reused,
  }))
}

async function a2Apply(relay, code, requestId) {
  const inviteItem = await waitFor(
    relay,
    'to-a2',
    (payload) => payload?.schema === 'irgeztne.enrollment.invite.v1'
  )
  const invite = inviteItem.payload
  const key = proofKey(code)

  // The orchestrator calls apply only after a matching delivery is known to
  // exist. Read the current mailbox snapshot once and select a cryptographically
  // valid copy. A corrupted copy must fail fast; a later network retry invokes
  // a2-apply again and can then select the authentic redelivery.
  const items = await list(relay, 'to-a2', 0)
  const matching = items.filter((item) => item.payload?.requestId === requestId)

  if (matching.length === 0) {
    throw err('APPROVAL_NOT_RECEIVED', 'No enrollment approval delivery was received')
  }

  let approval = null
  let lastRejection = null
  let invalidApprovalSeen = false

  // Prefer the newest authentic delivery. This matters after a relay-corrupted
  // first copy followed by an immutable A1 redelivery.
  for (let i = matching.length - 1; i >= 0; i -= 1) {
    const payload = matching[i].payload

    if (payload?.schema === 'irgeztne.enrollment.rejection.v1') {
      lastRejection = payload
      continue
    }
    if (payload?.schema !== 'irgeztne.enrollment.approval.v1') continue

    if (
      payload.enrollmentId !== invite.enrollmentId ||
      payload.deviceId !== A2.deviceId ||
      payload.memberIdentity !== A2.identity
    ) {
      invalidApprovalSeen = true
      continue
    }

    const expected = hmac(key, canonicalApproval(payload))
    if (!safeHex(payload.proof, expected)) {
      invalidApprovalSeen = true
      continue
    }

    approval = payload
    break
  }

  if (!approval) {
    if (invalidApprovalSeen) {
      throw err('APPROVAL_PROOF_INVALID', 'No cryptographically valid approval delivery was found')
    }
    if (lastRejection) {
      throw err(
        lastRejection.code || 'ENROLLMENT_REJECTED',
        lastRejection.message || 'Enrollment rejected'
      )
    }
    throw err('APPROVAL_NOT_RECEIVED', 'No usable enrollment approval delivery was received')
  }

  const prior = readJson(RECEIPT, null)
  const approvalHash = sha256Json(canonicalApproval(approval))

  if (
    prior &&
    prior.enrollmentId === approval.enrollmentId &&
    prior.requestId === approval.requestId &&
    prior.approvalHash === approvalHash
  ) {
    console.log(JSON.stringify({ ok: true, result: 'ALREADY_ENROLLED', receipt: prior }))
    return
  }

  const mod = await loadNative()
  const client = makeClient(mod.SecureLocalServiceClient, A2)
  try {
    await client.start()
    await client.joinGroup(approval.conversationId, approval.welcomeHex)
    const status = await client.groupStatus(approval.conversationId)
    const receipt = {
      schema: 'irgeztne.enrollment.receipt.v1',
      enrollmentId: approval.enrollmentId,
      requestId: approval.requestId,
      approvalHash,
      joinedAt: now(),
      status,
    }
    writeJson(RECEIPT, receipt)

    const pendingFile = path.join(
      PENDING_A2,
      `${String(requestId).replace(/[^a-zA-Z0-9._-]/g, '_')}.json`
    )
    try { fs.rmSync(pendingFile, { force: true }) } catch {}

    console.log(JSON.stringify({ ok: true, result: 'ENROLLED', receipt }))
  } finally {
    await client.close()
  }
}

async function status(which) {
  const spec = which === 'a1' ? A1 : A2
  const mod = await loadNative()
  const client = makeClient(mod.SecureLocalServiceClient, spec)
  try {
    await client.start()
    const value = await client.groupStatus(CONVERSATION_ID)
    console.log(JSON.stringify({ ok: true, which, status: value }))
  } finally {
    await client.close()
  }
}

async function sendMessage(which, relay, text) {
  const spec = which === 'a1' ? A1 : A2
  const to = which === 'a1' ? 'app-to-a2' : 'app-to-a1'
  const mod = await loadNative()
  const client = makeClient(mod.SecureLocalServiceClient, spec)
  try {
    await client.start()
    const encrypted = await client.encrypt(CONVERSATION_ID, text)
    const envelope = {
      schema: 'irgeztne.e3.application-envelope.v1',
      from: which,
      conversationId: CONVERSATION_ID,
      messageHex: encrypted.message_hex,
    }
    await post(relay, to, envelope)
    console.log(JSON.stringify({ ok: true }))
  } finally {
    await client.close()
  }
}

async function receiveMessage(which, relay) {
  const from = which === 'a1' ? 'app-to-a1' : 'app-to-a2'
  const item = await waitFor(
    relay,
    from,
    (payload) => payload?.schema === 'irgeztne.e3.application-envelope.v1'
  )
  const spec = which === 'a1' ? A1 : A2
  const mod = await loadNative()
  const client = makeClient(mod.SecureLocalServiceClient, spec)
  try {
    await client.start()
    const decrypted = await client.decrypt(CONVERSATION_ID, item.payload.messageHex)
    console.log(JSON.stringify({ ok: true, plaintext: decrypted.plaintext }))
  } finally {
    await client.close()
  }
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2)
  const relay = process.env.E3_RELAY_URL || ''

  if (cmd === 'reset') return reset()
  if (!relay && cmd !== 'status') throw new Error('E3_RELAY_URL is required')

  if (cmd === 'a1-server') return a1Server(relay)
  if (cmd === 'a2-send-request') return a2SendRequest(relay, process.env.E3_OOB_CODE || '', args[0] || crypto.randomUUID())
  if (cmd === 'a2-apply') return a2Apply(relay, process.env.E3_OOB_CODE || '', args[0])
  if (cmd === 'status') return status(args[0])
  if (cmd === 'send') return sendMessage(args[0], relay, args.slice(1).join(' '))
  if (cmd === 'receive') return receiveMessage(args[0], relay)

  throw new Error(`Unknown command: ${String(cmd || '')}`)
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    code: String(error?.code || ''),
    message: String(error?.message || error || ''),
  }))
  process.exitCode = 1
})
