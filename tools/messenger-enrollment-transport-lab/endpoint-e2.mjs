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
  'messenger-enrollment-transport-v02'
)
const DATA_ROOT = path.join(LAB_ROOT, 'endpoints')
const TRANSPORT_ROOT = path.join(LAB_ROOT, 'transport')
const A1_TO_A2 = path.join(TRANSPORT_ROOT, 'a1-to-a2')
const A2_TO_A1 = path.join(TRANSPORT_ROOT, 'a2-to-a1')
const PRIVATE_A1 = path.join(LAB_ROOT, 'private-a1')
const PRIVATE_A2 = path.join(LAB_ROOT, 'private-a2')
const REGISTRY_PATH = path.join(PRIVATE_A1, 'registry.json')
const RECEIPT_PATH = path.join(PRIVATE_A2, 'enrollment-receipt.json')

const ACCOUNT_ID = 'account-a'
const CONVERSATION_ID = 'e2-transport-group-v02'
const KEYRING_PREFIX = 'com.irgeztne.green-lightning.sandbox.enrollment.transport.v02'
const TTL_MS = 5 * 60 * 1000

const A1 = {
  accountId: ACCOUNT_ID,
  deviceId: 'device-a1',
  label: 'Primary Workspace',
  identity: 'sandbox/account-a/device-a1-e2',
  keyringService: `${KEYRING_PREFIX}.a1`,
}
const A2 = {
  accountId: ACCOUNT_ID,
  deviceId: 'device-a2',
  label: 'Second Workspace',
  identity: 'sandbox/account-a/device-a2-e2',
  keyringService: `${KEYRING_PREFIX}.a2`,
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
}

function writeJson(file, value) {
  ensureDir(path.dirname(file))
  fs.writeFileSync(
    file,
    JSON.stringify(value, null, 2) + '\n',
    { encoding: 'utf8', mode: 0o600 }
  )
  try { fs.chmodSync(file, 0o600) } catch {}
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function nowIso() {
  return new Date().toISOString()
}

function sha256Text(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex')
}

function sha256Json(value) {
  return sha256Text(JSON.stringify(value))
}

function hmacHex(key, value) {
  return crypto.createHmac('sha256', key).update(JSON.stringify(value)).digest('hex')
}

function proofKeyFromCode(code) {
  return crypto.createHmac('sha256', 'IRGEZTNE-E2-PAIRING-v1').update(String(code)).digest()
}

function safeEqualHex(a, b) {
  try {
    const aa = Buffer.from(String(a || ''), 'hex')
    const bb = Buffer.from(String(b || ''), 'hex')
    return aa.length > 0 && aa.length === bb.length && crypto.timingSafeEqual(aa, bb)
  } catch {
    return false
  }
}

function typedError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function assert(value, message) {
  if (!value) throw new Error(message)
}

function canonicalInvite(invite) {
  return {
    schema: invite.schema,
    version: invite.version,
    enrollmentId: invite.enrollmentId,
    accountId: invite.accountId,
    conversationId: invite.conversationId,
    inviterDeviceId: invite.inviterDeviceId,
    challenge: invite.challenge,
    expiresAt: invite.expiresAt,
  }
}

function canonicalRequest(request) {
  return {
    schema: request.schema,
    version: request.version,
    enrollmentId: request.enrollmentId,
    inviteHash: request.inviteHash,
    accountId: request.accountId,
    conversationId: request.conversationId,
    deviceId: request.deviceId,
    deviceLabel: request.deviceLabel,
    memberIdentity: request.memberIdentity,
    keyPackageHex: request.keyPackageHex,
  }
}

function canonicalApproval(approval) {
  return {
    schema: approval.schema,
    version: approval.version,
    result: approval.result,
    enrollmentId: approval.enrollmentId,
    requestHash: approval.requestHash,
    accountId: approval.accountId,
    conversationId: approval.conversationId,
    deviceId: approval.deviceId,
    memberIdentity: approval.memberIdentity,
    welcomeHex: approval.welcomeHex,
    commitHex: approval.commitHex,
    epoch: approval.epoch,
    members: approval.members,
  }
}

function defaultRegistry() {
  const createdAt = nowIso()
  return {
    schema: 'irgeztne.e2.registry.v1',
    version: 1,
    accountId: ACCOUNT_ID,
    conversationId: CONVERSATION_ID,
    createdAt,
    updatedAt: createdAt,
    devices: [{
      deviceId: A1.deviceId,
      memberIdentity: A1.identity,
      label: A1.label,
      status: 'active',
      current: true,
      createdAt,
    }],
    consumedRequests: {},
  }
}

function loadRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) {
    const state = defaultRegistry()
    writeJson(REGISTRY_PATH, state)
    return state
  }
  return readJson(REGISTRY_PATH)
}

function saveRegistry(state) {
  state.updatedAt = nowIso()
  writeJson(REGISTRY_PATH, state)
}

function registryDevice(state, deviceId) {
  return state.devices.find((device) => device.deviceId === deviceId) || null
}

async function loadClient() {
  if (!fs.existsSync(CLIENT_PATH)) throw new Error(`Missing client: ${CLIENT_PATH}`)
  if (!fs.existsSync(BINARY)) throw new Error(`Missing P21 binary: ${BINARY}`)
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

async function cmdReset() {
  const mod = await loadClient()
  ensureDir(LAB_ROOT)
  for (const spec of [A1, A2]) {
    try {
      mod.deleteRootKey({
        keyringService: spec.keyringService,
        binaryPath: BINARY,
      })
    } catch {}
  }
  try { fs.rmSync(LAB_ROOT, { recursive: true, force: true }) } catch {}
  ensureDir(A1_TO_A2)
  ensureDir(A2_TO_A1)
  ensureDir(PRIVATE_A1)
  ensureDir(PRIVATE_A2)
  writeJson(REGISTRY_PATH, defaultRegistry())
  console.log(JSON.stringify({ ok: true }))
}

async function cmdA1Bootstrap() {
  const mod = await loadClient()
  const client = makeClient(mod.SecureLocalServiceClient, A1)
  try {
    await client.start()
    const ping = await client.ping()
    assert(ping?.service_version === '0.4N-P21', `Expected P21 binary; got ${ping?.service_version}`)
    await client.createGroup(CONVERSATION_ID)

    const enrollmentId = crypto.randomUUID()
    const challenge = crypto.randomBytes(24).toString('base64url')
    const code = crypto.randomBytes(32).toString('base64url')
    const expiresAtMs = Date.now() + TTL_MS

    const invite = {
      schema: 'irgeztne.enrollment.invite.v1',
      version: 1,
      enrollmentId,
      accountId: ACCOUNT_ID,
      conversationId: CONVERSATION_ID,
      inviterDeviceId: A1.deviceId,
      challenge,
      expiresAt: new Date(expiresAtMs).toISOString(),
    }

    writeJson(path.join(A1_TO_A2, 'invite.json'), invite)

    // Secret stays only in this long-running A1 process. It is deliberately
    // emitted once to stdout to simulate the human/operator out-of-band channel.
    const ready = {
      ok: true,
      code,
      invitePath: path.join(A1_TO_A2, 'invite.json'),
      enrollmentId,
    }
    console.log(`E2_READY:${JSON.stringify(ready)}`)

    const proofKey = proofKeyFromCode(code)
    const inviteHash = sha256Json(canonicalInvite(invite))
    const seen = new Set()
    let running = true

    const processRequest = async (file) => {
      const base = path.basename(file)
      if (seen.has(base)) return
      seen.add(base)

      let request
      let response
      try {
        const stat = fs.statSync(file)
        if (stat.size > 1024 * 1024) {
          throw typedError('REQUEST_TOO_LARGE', 'Enrollment request exceeds 1 MiB')
        }

        request = readJson(file)
        if (request?.schema !== 'irgeztne.enrollment.request.v1' || request?.version !== 1) {
          throw typedError('REQUEST_SCHEMA_INVALID', 'Unsupported enrollment request schema')
        }
        if (request.enrollmentId !== invite.enrollmentId) {
          throw typedError('ENROLLMENT_ID_MISMATCH', 'Enrollment id mismatch')
        }
        if (request.inviteHash !== inviteHash) {
          throw typedError('INVITE_HASH_MISMATCH', 'Public invite hash mismatch')
        }
        if (Date.now() > expiresAtMs) {
          throw typedError('ENROLLMENT_EXPIRED', 'Enrollment invite expired')
        }
        if (request.accountId !== ACCOUNT_ID) {
          throw typedError('ACCOUNT_MISMATCH', 'Account mismatch')
        }
        if (request.conversationId !== CONVERSATION_ID) {
          throw typedError('CONVERSATION_MISMATCH', 'Conversation mismatch')
        }
        if (!request.deviceId || !request.memberIdentity || !request.keyPackageHex) {
          throw typedError('REQUEST_FIELDS_MISSING', 'Required enrollment fields are missing')
        }

        const expectedProof = hmacHex(proofKey, canonicalRequest(request))
        if (!safeEqualHex(request.proof, expectedProof)) {
          throw typedError('REQUEST_PROOF_INVALID', 'Enrollment request proof is invalid')
        }

        const requestHash = sha256Json(canonicalRequest(request))
        const registry = loadRegistry()
        const consumed = registry.consumedRequests[invite.enrollmentId]

        if (consumed) {
          const existing = registryDevice(registry, request.deviceId)
          if (
            consumed.requestHash === requestHash &&
            existing &&
            existing.status === 'active' &&
            existing.memberIdentity === request.memberIdentity
          ) {
            response = {
              schema: 'irgeztne.enrollment.approval.v1',
              version: 1,
              result: 'ALREADY_ENROLLED',
              enrollmentId: invite.enrollmentId,
              requestHash,
              accountId: ACCOUNT_ID,
              conversationId: CONVERSATION_ID,
              deviceId: request.deviceId,
              memberIdentity: request.memberIdentity,
              welcomeHex: null,
              commitHex: null,
              epoch: consumed.epoch,
              members: consumed.members,
            }
            response.proof = hmacHex(proofKey, canonicalApproval(response))
          } else {
            throw typedError('ENROLLMENT_REPLAY', 'Consumed enrollment was replayed with different content')
          }
        } else {
          const existing = registryDevice(registry, request.deviceId)
          if (
            existing &&
            existing.memberIdentity !== request.memberIdentity
          ) {
            throw typedError('DEVICE_ID_CONFLICT', 'deviceId is already bound to another identity')
          }

          const add = await client.addMember(
            CONVERSATION_ID,
            request.keyPackageHex
          )
          if (!add?.welcome_hex || !add?.commit_hex) {
            throw typedError('MLS_ADD_CONTRACT_ERROR', 'MLS addMember did not return Welcome + Commit')
          }

          registry.devices.push({
            deviceId: request.deviceId,
            memberIdentity: request.memberIdentity,
            label: request.deviceLabel || 'Second Workspace',
            status: 'active',
            current: false,
            createdAt: nowIso(),
          })
          registry.consumedRequests[invite.enrollmentId] = {
            requestHash,
            deviceId: request.deviceId,
            memberIdentity: request.memberIdentity,
            epoch: Number(add.epoch),
            members: Number(add.members),
            consumedAt: nowIso(),
          }
          saveRegistry(registry)

          response = {
            schema: 'irgeztne.enrollment.approval.v1',
            version: 1,
            result: 'ENROLLED',
            enrollmentId: invite.enrollmentId,
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
          response.proof = hmacHex(proofKey, canonicalApproval(response))
        }
      } catch (error) {
        response = {
          schema: 'irgeztne.enrollment.rejection.v1',
          version: 1,
          result: 'REJECTED',
          enrollmentId: request?.enrollmentId || invite.enrollmentId,
          code: String(error?.code || 'ENROLLMENT_ERROR'),
          message: String(error?.message || error || 'Enrollment rejected'),
        }
      }

      const suffix = base.replace(/^request-/, '').replace(/\.json$/i, '')
      writeJson(path.join(A1_TO_A2, `response-${suffix}.json`), response)
    }

    const stopFile = path.join(PRIVATE_A1, 'stop')
    while (running) {
      const entries = fs.readdirSync(A2_TO_A1)
        .filter((name) => /^request-.*\.json$/i.test(name))
        .sort()

      for (const entry of entries) {
        await processRequest(path.join(A2_TO_A1, entry))
      }

      if (fs.existsSync(stopFile)) running = false
      await new Promise((resolve) => setTimeout(resolve, 80))
    }
  } finally {
    await client.close()
  }
}

async function cmdA2MakeRequest(args) {
  const mod = await loadClient()
  const inviteFile = args[0]
  const outputFile = args[1]
  if (!inviteFile || !outputFile) throw new Error('a2-make-request requires inviteFile outputFile')
  const code = process.env.E2_OOB_CODE || ''
  if (!code) throw new Error('E2_OOB_CODE is required')

  const invite = readJson(inviteFile)
  const client = makeClient(mod.SecureLocalServiceClient, A2)
  try {
    await client.start()
    const kp = await client.keyPackage()
    assert(kp?.key_package_hex, 'A2 KeyPackage missing')

    const request = {
      schema: 'irgeztne.enrollment.request.v1',
      version: 1,
      enrollmentId: invite.enrollmentId,
      inviteHash: sha256Json(canonicalInvite(invite)),
      accountId: A2.accountId,
      conversationId: invite.conversationId,
      deviceId: A2.deviceId,
      deviceLabel: A2.label,
      memberIdentity: A2.identity,
      keyPackageHex: kp.key_package_hex,
    }
    request.proof = hmacHex(proofKeyFromCode(code), canonicalRequest(request))
    writeJson(outputFile, request)
    console.log(JSON.stringify({
      ok: true,
      requestPath: outputFile,
      requestHash: sha256Json(canonicalRequest(request)),
    }))
  } finally {
    await client.close()
  }
}

async function cmdA2ApplyApproval(args) {
  const inviteFile = args[0]
  const requestFile = args[1]
  const approvalFile = args[2]
  if (!inviteFile || !requestFile || !approvalFile) {
    throw new Error('a2-apply-approval requires inviteFile requestFile approvalFile')
  }
  const code = process.env.E2_OOB_CODE || ''
  if (!code) throw new Error('E2_OOB_CODE is required')

  const invite = readJson(inviteFile)
  const request = readJson(requestFile)
  const approval = readJson(approvalFile)

  if (approval?.schema !== 'irgeztne.enrollment.approval.v1' || approval?.version !== 1) {
    throw typedError('APPROVAL_SCHEMA_INVALID', 'Unsupported approval schema')
  }
  if (approval.enrollmentId !== invite.enrollmentId) {
    throw typedError('APPROVAL_ENROLLMENT_MISMATCH', 'Approval enrollment id mismatch')
  }

  const requestHash = sha256Json(canonicalRequest(request))
  if (approval.requestHash !== requestHash) {
    throw typedError('APPROVAL_REQUEST_MISMATCH', 'Approval does not match the request')
  }
  if (approval.deviceId !== A2.deviceId || approval.memberIdentity !== A2.identity) {
    throw typedError('APPROVAL_DEVICE_MISMATCH', 'Approval is not for this device')
  }

  const expected = hmacHex(proofKeyFromCode(code), canonicalApproval(approval))
  if (!safeEqualHex(approval.proof, expected)) {
    throw typedError('APPROVAL_PROOF_INVALID', 'Approval proof is invalid')
  }

  if (approval.result === 'ALREADY_ENROLLED') {
    console.log(JSON.stringify({ ok: true, result: 'ALREADY_ENROLLED' }))
    return
  }
  if (approval.result !== 'ENROLLED' || !approval.welcomeHex) {
    throw typedError('APPROVAL_RESULT_INVALID', 'Enrollment approval has no Welcome')
  }

  const mod = await loadClient()
  const client = makeClient(mod.SecureLocalServiceClient, A2)
  try {
    await client.start()
    await client.joinGroup(invite.conversationId, approval.welcomeHex)
    const status = await client.groupStatus(invite.conversationId)
    writeJson(RECEIPT_PATH, {
      schema: 'irgeztne.enrollment.receipt.v1',
      version: 1,
      enrolledAt: nowIso(),
      accountId: A2.accountId,
      deviceId: A2.deviceId,
      memberIdentity: A2.identity,
      conversationId: invite.conversationId,
      enrollmentId: invite.enrollmentId,
      requestHash,
      status,
    })
    console.log(JSON.stringify({ ok: true, result: 'ENROLLED', status }))
  } finally {
    await client.close()
  }
}

async function cmdStatus(args) {
  const which = args[0]
  const spec = which === 'a1' ? A1 : which === 'a2' ? A2 : null
  if (!spec) throw new Error('status requires a1|a2')
  const mod = await loadClient()
  const client = makeClient(mod.SecureLocalServiceClient, spec)
  try {
    await client.start()
    const status = await client.groupStatus(CONVERSATION_ID)
    console.log(JSON.stringify({ ok: true, which, status }))
  } finally {
    await client.close()
  }
}

async function cmdEncrypt(args) {
  const which = args[0]
  const outputFile = args[1]
  const plaintext = args.slice(2).join(' ')
  const spec = which === 'a1' ? A1 : which === 'a2' ? A2 : null
  if (!spec || !outputFile || !plaintext) throw new Error('encrypt requires a1|a2 outputFile plaintext')
  const mod = await loadClient()
  const client = makeClient(mod.SecureLocalServiceClient, spec)
  try {
    await client.start()
    const encrypted = await client.encrypt(CONVERSATION_ID, plaintext)
    writeJson(outputFile, {
      schema: 'irgeztne.e2.cipher-envelope.v1',
      from: which,
      conversationId: CONVERSATION_ID,
      messageHex: encrypted.message_hex,
    })
    console.log(JSON.stringify({ ok: true }))
  } finally {
    await client.close()
  }
}

async function cmdDecrypt(args) {
  const which = args[0]
  const inputFile = args[1]
  const spec = which === 'a1' ? A1 : which === 'a2' ? A2 : null
  if (!spec || !inputFile) throw new Error('decrypt requires a1|a2 inputFile')
  const envelope = readJson(inputFile)
  const mod = await loadClient()
  const client = makeClient(mod.SecureLocalServiceClient, spec)
  try {
    await client.start()
    const decrypted = await client.decrypt(CONVERSATION_ID, envelope.messageHex)
    console.log(JSON.stringify({ ok: true, plaintext: decrypted.plaintext }))
  } finally {
    await client.close()
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2)

  if (command === 'reset') return cmdReset()
  if (command === 'a1-server') return cmdA1Bootstrap()
  if (command === 'a2-make-request') return cmdA2MakeRequest(args)
  if (command === 'a2-apply-approval') return cmdA2ApplyApproval(args)
  if (command === 'status') return cmdStatus(args)
  if (command === 'encrypt') return cmdEncrypt(args)
  if (command === 'decrypt') return cmdDecrypt(args)

  throw new Error(`Unknown endpoint command: ${String(command || '')}`)
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    code: String(error?.code || ''),
    message: String(error?.message || error || ''),
  }))
  process.exitCode = 1
})
