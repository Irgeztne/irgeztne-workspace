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
  'messenger-second-device-enrollment-v01'
)
const DATA_ROOT = path.join(LAB_ROOT, 'data')
const REGISTRY_PATH = path.join(LAB_ROOT, 'device-registry.json')
const REPORT_PATH = path.join(LAB_ROOT, 'last-report.json')
const CONVERSATION_ID = 'second-device-enrollment-v01'
const ACCOUNT_ID = 'account-a'
const KEYRING_PREFIX = 'com.irgeztne.green-lightning.sandbox.enrollment.v01'
const SESSION_TTL_MS = 5 * 60 * 1000

const DEVICES = {
  a1: {
    accountId: ACCOUNT_ID,
    deviceId: 'device-a1',
    label: 'Primary Workspace',
    identity: 'sandbox/account-a/device-a1',
    keyringService: `${KEYRING_PREFIX}.a1`,
  },
  a2: {
    accountId: ACCOUNT_ID,
    deviceId: 'device-a2',
    label: 'Second Workspace',
    identity: 'sandbox/account-a/device-a2',
    keyringService: `${KEYRING_PREFIX}.a2`,
  },
}

function now() { return new Date().toISOString() }
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }) }
function clone(v) { return JSON.parse(JSON.stringify(v)) }
function writeJson(file, value) {
  ensureDir(path.dirname(file))
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 })
  try { fs.chmodSync(file, 0o600) } catch {}
}
function err(code, message) {
  const e = new Error(message)
  e.code = code
  return e
}
function assert(v, m) { if (!v) throw new Error(m) }
function say(status, name, detail = '') {
  console.log(`${status.padEnd(5)} ${name}${detail ? ` — ${detail}` : ''}`)
}
function compactError(e) {
  return {
    code: String(e?.code || ''),
    message: String(e?.message || e || ''),
  }
}

class EnrollmentRegistry {
  constructor(file) {
    this.file = file
    this.state = null
  }

  createFresh() {
    const createdAt = now()
    this.state = {
      schema: 'irgeztne.second-device.enrollment.registry.v1',
      version: 1,
      accountId: ACCOUNT_ID,
      createdAt,
      updatedAt: createdAt,
      devices: [{
        accountId: ACCOUNT_ID,
        deviceId: DEVICES.a1.deviceId,
        label: DEVICES.a1.label,
        memberIdentity: DEVICES.a1.identity,
        status: 'active',
        current: true,
        createdAt,
        activatedAt: createdAt,
        memberships: [CONVERSATION_ID],
      }],
      consumedEnrollmentIds: [],
    }
    this.persist()
  }

  load() {
    this.state = JSON.parse(fs.readFileSync(this.file, 'utf8'))
    return this.state
  }

  persist() {
    this.state.updatedAt = now()
    writeJson(this.file, this.state)
  }

  device(deviceId) {
    return this.state.devices.find((d) => d.deviceId === deviceId) || null
  }

  byIdentity(identity) {
    return this.state.devices.find((d) => d.memberIdentity === identity) || null
  }

  reserve(request) {
    if (request.accountId !== this.state.accountId) {
      throw err('ACCOUNT_MISMATCH', 'Enrollment request belongs to a different account')
    }

    const existingId = this.device(request.deviceId)
    if (existingId) {
      if (
        existingId.memberIdentity === request.memberIdentity &&
        existingId.status === 'active'
      ) {
        return { result: 'ALREADY_ENROLLED', device: clone(existingId) }
      }
      throw err('DEVICE_ID_CONFLICT', 'deviceId is already registered to a different device identity')
    }

    const existingIdentity = this.byIdentity(request.memberIdentity)
    if (existingIdentity) {
      throw err('MEMBER_IDENTITY_CONFLICT', 'member identity is already registered under another deviceId')
    }

    const device = {
      accountId: request.accountId,
      deviceId: request.deviceId,
      label: request.label,
      memberIdentity: request.memberIdentity,
      status: 'enrolling',
      current: false,
      createdAt: now(),
      activatedAt: null,
      memberships: [],
      enrollmentId: request.enrollmentId,
    }
    this.state.devices.push(device)
    this.persist()
    return { result: 'RESERVED', device: clone(device) }
  }

  activate(deviceId) {
    const device = this.device(deviceId)
    if (!device) throw err('DEVICE_UNKNOWN', `Unknown device ${deviceId}`)
    device.status = 'active'
    device.activatedAt = now()
    if (!device.memberships.includes(CONVERSATION_ID)) device.memberships.push(CONVERSATION_ID)
    this.persist()
    return clone(device)
  }

  removeReservation(deviceId) {
    const device = this.device(deviceId)
    if (!device || device.status !== 'enrolling') return
    this.state.devices = this.state.devices.filter((d) => d.deviceId !== deviceId)
    this.persist()
  }

  markConsumed(enrollmentId) {
    if (!this.state.consumedEnrollmentIds.includes(enrollmentId)) {
      this.state.consumedEnrollmentIds.push(enrollmentId)
      if (this.state.consumedEnrollmentIds.length > 500) {
        this.state.consumedEnrollmentIds = this.state.consumedEnrollmentIds.slice(-500)
      }
      this.persist()
    }
  }

  isConsumed(enrollmentId) {
    return this.state.consumedEnrollmentIds.includes(enrollmentId)
  }
}

class EnrollmentSessionManager {
  constructor() {
    this.sessions = new Map()
  }

  create({ accountId }) {
    const enrollmentId = crypto.randomUUID()
    const code = crypto.randomBytes(32).toString('base64url')
    const createdAtMs = Date.now()
    const session = {
      enrollmentId,
      accountId,
      codeHash: crypto.createHash('sha256').update(code).digest('hex'),
      createdAtMs,
      expiresAtMs: createdAtMs + SESSION_TTL_MS,
      consumed: false,
    }
    this.sessions.set(enrollmentId, session)
    return {
      enrollmentId,
      accountId,
      code,
      expiresAt: new Date(session.expiresAtMs).toISOString(),
    }
  }

  validate({ enrollmentId, accountId, code }) {
    const session = this.sessions.get(enrollmentId)
    if (!session) throw err('ENROLLMENT_UNKNOWN', 'Enrollment session does not exist')
    if (session.consumed) throw err('ENROLLMENT_REPLAY', 'Enrollment session was already consumed')
    if (Date.now() > session.expiresAtMs) throw err('ENROLLMENT_EXPIRED', 'Enrollment session expired')
    if (session.accountId !== accountId) throw err('ACCOUNT_MISMATCH', 'Enrollment account mismatch')

    const supplied = crypto.createHash('sha256').update(String(code || '')).digest()
    const expected = Buffer.from(session.codeHash, 'hex')
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
      throw err('ENROLLMENT_CODE_INVALID', 'Enrollment code is invalid')
    }

    return session
  }

  consume(enrollmentId) {
    const session = this.sessions.get(enrollmentId)
    if (!session) throw err('ENROLLMENT_UNKNOWN', 'Enrollment session does not exist')
    session.consumed = true
  }
}

function buildRequest({ invite, keyPackageHex, device = DEVICES.a2, overrides = {} }) {
  return {
    enrollmentId: invite.enrollmentId,
    accountId: device.accountId,
    code: invite.code,
    deviceId: device.deviceId,
    label: device.label,
    memberIdentity: device.identity,
    keyPackageHex,
    ...overrides,
  }
}

async function enrollSecondDevice({
  registry,
  sessions,
  primaryClient,
  request,
}) {
  if (!request || typeof request !== 'object') throw err('INVALID_REQUEST', 'Enrollment request is required')
  if (!request.enrollmentId) throw err('INVALID_REQUEST', 'enrollmentId is required')
  if (!request.deviceId) throw err('INVALID_REQUEST', 'deviceId is required')
  if (!request.memberIdentity) throw err('INVALID_REQUEST', 'memberIdentity is required')
  if (!request.keyPackageHex) throw err('INVALID_REQUEST', 'keyPackageHex is required')

  if (registry.isConsumed(request.enrollmentId)) {
    const existing = registry.device(request.deviceId)
    if (
      existing &&
      existing.status === 'active' &&
      existing.memberIdentity === request.memberIdentity
    ) {
      return {
        result: 'ALREADY_ENROLLED',
        device: clone(existing),
        welcomeHex: null,
        commitHex: null,
      }
    }
    throw err('ENROLLMENT_REPLAY', 'Consumed enrollment cannot be used for a different device')
  }

  sessions.validate({
    enrollmentId: request.enrollmentId,
    accountId: request.accountId,
    code: request.code,
  })

  const reservation = registry.reserve(request)
  if (reservation.result === 'ALREADY_ENROLLED') {
    registry.markConsumed(request.enrollmentId)
    sessions.consume(request.enrollmentId)
    return {
      result: 'ALREADY_ENROLLED',
      device: reservation.device,
      welcomeHex: null,
      commitHex: null,
    }
  }

  try {
    const add = await primaryClient.addMember(
      CONVERSATION_ID,
      request.keyPackageHex
    )
    if (!add?.welcome_hex || !add?.commit_hex) {
      throw err('MLS_ADD_CONTRACT_ERROR', 'addMember did not return welcome_hex + commit_hex')
    }

    registry.activate(request.deviceId)
    registry.markConsumed(request.enrollmentId)
    sessions.consume(request.enrollmentId)

    return {
      result: 'ENROLLED',
      device: clone(registry.device(request.deviceId)),
      welcomeHex: add.welcome_hex,
      commitHex: add.commit_hex,
      epoch: Number(add.epoch),
      members: Number(add.members),
    }
  } catch (error) {
    registry.removeReservation(request.deviceId)
    throw error
  }
}

async function closeClients(...clients) {
  await Promise.allSettled(clients.filter(Boolean).map((c) => c.close()))
}

async function main() {
  if (!fs.existsSync(CLIENT_PATH)) throw new Error(`secure-local-service client missing: ${CLIENT_PATH}`)
  if (!fs.existsSync(BINARY)) throw new Error(`P21 production native binary missing: ${BINARY}`)

  const mod = await import(pathToFileURL(CLIENT_PATH).href)
  const { SecureLocalServiceClient, deleteRootKey } = mod
  assert(typeof SecureLocalServiceClient === 'function', 'SecureLocalServiceClient unavailable')
  assert(typeof deleteRootKey === 'function', 'deleteRootKey unavailable')
  assert(typeof SecureLocalServiceClient.prototype.removeMember === 'function', 'P21 removeMember contract unavailable')

  ensureDir(LAB_ROOT)
  for (const device of Object.values(DEVICES)) {
    try {
      deleteRootKey({ keyringService: device.keyringService, binaryPath: BINARY })
    } catch {}
  }
  try { fs.rmSync(DATA_ROOT, { recursive: true, force: true }) } catch {}
  try { fs.rmSync(REGISTRY_PATH, { force: true }) } catch {}
  try { fs.rmSync(REPORT_PATH, { force: true }) } catch {}
  ensureDir(DATA_ROOT)

  const report = {
    schema: 'irgeztne.second-device.enrollment.lab.report.v1',
    startedAt: now(),
    labRoot: LAB_ROOT,
    productionBinary: BINARY,
    tests: [],
  }
  const pass = (name, detail = '') => {
    report.tests.push({ name, status: 'PASS', detail })
    say('PASS', name, detail)
  }

  const registry = new EnrollmentRegistry(REGISTRY_PATH)
  registry.createFresh()
  const sessions = new EnrollmentSessionManager()

  let a1 = null
  let a2 = null

  console.log('')
  console.log('IRGEZTNE Messenger — Second Device Enrollment Lab v0.1E1')
  console.log(`Sandbox: ${LAB_ROOT}`)
  console.log('Uses installed P21 production crypto binary with isolated data/keyring.')
  console.log('Live Messenger data, account state, and keyring namespace are NOT used.')
  console.log('')

  try {
    a1 = new SecureLocalServiceClient({
      dataDir: path.join(DATA_ROOT, 'a1'),
      identity: DEVICES.a1.identity,
      keyringService: DEVICES.a1.keyringService,
      binaryPath: BINARY,
    })
    a2 = new SecureLocalServiceClient({
      dataDir: path.join(DATA_ROOT, 'a2'),
      identity: DEVICES.a2.identity,
      keyringService: DEVICES.a2.keyringService,
      binaryPath: BINARY,
    })
    await a1.start()
    await a2.start()

    const ping = await a1.ping()
    assert(ping?.service_version === '0.4N-P21', `expected P21 binary, got ${ping?.service_version}`)
    pass('p21_production_crypto_core', 'service_version=0.4N-P21')

    await a1.createGroup(CONVERSATION_ID)
    pass('primary_device_group_bootstrap', 'A1 created MLS group')

    const kpA2 = await a2.keyPackage()
    assert(kpA2?.key_package_hex, 'A2 KeyPackage missing')
    pass('second_device_generates_own_keypackage', 'A2 has independent keyring + MLS KeyPackage')

    const inviteBad = sessions.create({ accountId: ACCOUNT_ID })
    const badCodeRequest = buildRequest({
      invite: inviteBad,
      keyPackageHex: kpA2.key_package_hex,
      overrides: { code: 'wrong-code' },
    })
    let badCodeDenied = false
    try {
      await enrollSecondDevice({ registry, sessions, primaryClient: a1, request: badCodeRequest })
    } catch (e) {
      badCodeDenied = e?.code === 'ENROLLMENT_CODE_INVALID'
    }
    assert(badCodeDenied, 'wrong enrollment code was not denied')
    assert(!registry.device(DEVICES.a2.deviceId), 'bad code created a registry device')
    pass('wrong_enrollment_code_denied', 'no registry/MLS mutation')

    const inviteAccount = sessions.create({ accountId: ACCOUNT_ID })
    const wrongAccountRequest = buildRequest({
      invite: inviteAccount,
      keyPackageHex: kpA2.key_package_hex,
      overrides: { accountId: 'account-other' },
    })
    let wrongAccountDenied = false
    try {
      await enrollSecondDevice({ registry, sessions, primaryClient: a1, request: wrongAccountRequest })
    } catch (e) {
      wrongAccountDenied = e?.code === 'ACCOUNT_MISMATCH'
    }
    assert(wrongAccountDenied, 'wrong account enrollment was not denied')
    pass('wrong_account_denied', 'A2 cannot enroll under another account')

    const invite = sessions.create({ accountId: ACCOUNT_ID })
    const request = buildRequest({
      invite,
      keyPackageHex: kpA2.key_package_hex,
    })

    const enrolled = await enrollSecondDevice({
      registry,
      sessions,
      primaryClient: a1,
      request,
    })
    report.firstEnrollment = {
      result: enrolled.result,
      device: enrolled.device,
      epoch: enrolled.epoch,
      members: enrolled.members,
    }

    assert(enrolled.result === 'ENROLLED', 'first enrollment did not return ENROLLED')
    assert(enrolled.welcomeHex && enrolled.commitHex, 'enrollment missing Welcome/Commit')
    assert(registry.device(DEVICES.a2.deviceId)?.status === 'active', 'A2 not active in registry')
    pass('primary_approves_second_device', 'Registry active + MLS Welcome issued')

    await a2.joinGroup(CONVERSATION_ID, enrolled.welcomeHex)
    const statusA1 = await a1.groupStatus(CONVERSATION_ID)
    const statusA2 = await a2.groupStatus(CONVERSATION_ID)
    assert(Number(statusA1.members) === 2 && Number(statusA2.members) === 2, 'expected two-member MLS group')
    assert(String(statusA1.group_id_hex) === String(statusA2.group_id_hex), 'A1/A2 group mismatch')
    pass('second_device_joins_mls', 'A1 + A2 share one two-member group')

    const plaintext = `E1 A1->A2 ${crypto.randomUUID()}`
    const encrypted = await a1.encrypt(CONVERSATION_ID, plaintext)
    const decrypted = await a2.decrypt(CONVERSATION_ID, encrypted.message_hex)
    assert(decrypted?.plaintext === plaintext, 'A2 could not decrypt A1 traffic')
    pass('primary_to_second_device_traffic')

    const plaintext2 = `E1 A2->A1 ${crypto.randomUUID()}`
    const encrypted2 = await a2.encrypt(CONVERSATION_ID, plaintext2)
    const decrypted2 = await a1.decrypt(CONVERSATION_ID, encrypted2.message_hex)
    assert(decrypted2?.plaintext === plaintext2, 'A1 could not decrypt A2 traffic')
    pass('second_to_primary_device_traffic')

    // Replaying the exact consumed request is an application no-op.
    const beforeReplay = await a1.groupStatus(CONVERSATION_ID)
    const replay = await enrollSecondDevice({
      registry,
      sessions,
      primaryClient: a1,
      request,
    })
    const afterReplay = await a1.groupStatus(CONVERSATION_ID)
    assert(replay.result === 'ALREADY_ENROLLED', 'replay did not return ALREADY_ENROLLED')
    assert(Number(beforeReplay.epoch) === Number(afterReplay.epoch), 'replay changed MLS epoch')
    assert(Number(beforeReplay.members) === Number(afterReplay.members), 'replay changed member count')
    pass('exact_enrollment_replay_noop', 'ALREADY_ENROLLED; MLS unchanged')

    // Same device_id with a different cryptographic identity is rejected before MLS.
    const inviteConflict = sessions.create({ accountId: ACCOUNT_ID })
    const conflictRequest = buildRequest({
      invite: inviteConflict,
      keyPackageHex: kpA2.key_package_hex,
      overrides: { memberIdentity: 'sandbox/account-a/device-a2-evil' },
    })
    let deviceConflictDenied = false
    try {
      await enrollSecondDevice({
        registry,
        sessions,
        primaryClient: a1,
        request: conflictRequest,
      })
    } catch (e) {
      deviceConflictDenied = e?.code === 'DEVICE_ID_CONFLICT'
    }
    assert(deviceConflictDenied, 'device_id identity conflict was not denied')
    pass('device_id_identity_conflict_denied', 'no second MLS add')

    await closeClients(a1, a2)
    a1 = null
    a2 = null
    pass('services_close_for_restart')

    const registry2 = new EnrollmentRegistry(REGISTRY_PATH)
    registry2.load()
    assert(registry2.device(DEVICES.a2.deviceId)?.status === 'active', 'A2 registry state lost after restart')
    pass('device_registry_restart_persistence', 'A2 remains active')

    a1 = new SecureLocalServiceClient({
      dataDir: path.join(DATA_ROOT, 'a1'),
      identity: DEVICES.a1.identity,
      keyringService: DEVICES.a1.keyringService,
      binaryPath: BINARY,
    })
    a2 = new SecureLocalServiceClient({
      dataDir: path.join(DATA_ROOT, 'a2'),
      identity: DEVICES.a2.identity,
      keyringService: DEVICES.a2.keyringService,
      binaryPath: BINARY,
    })
    await a1.start()
    await a2.start()

    const restartA1 = await a1.groupStatus(CONVERSATION_ID)
    const restartA2 = await a2.groupStatus(CONVERSATION_ID)
    assert(restartA1?.active === true && restartA2?.active === true, 'A1/A2 inactive after restart')
    assert(Number(restartA1.members) === 2 && Number(restartA2.members) === 2, 'two-member group not persisted')
    pass('mls_enrollment_restart_persistence', 'both devices active after restart')

    const restartText = `E1 restart ${crypto.randomUUID()}`
    const restartCipher = await a2.encrypt(CONVERSATION_ID, restartText)
    const restartDec = await a1.decrypt(CONVERSATION_ID, restartCipher.message_hex)
    assert(restartDec?.plaintext === restartText, 'post-restart A2->A1 traffic failed')
    pass('second_device_traffic_after_restart')

    report.finishedAt = now()
    report.summary = {
      result: 'PASS',
      secondDeviceOwnKeyPackage: true,
      oneTimeEnrollmentCode: true,
      accountBinding: true,
      deviceIdConflictProtection: true,
      exactReplayNoop: true,
      mlsWelcomeJoin: true,
      bidirectionalTraffic: true,
      restartPersistence: true,
      liveWorkspaceModified: false,
    }
    writeJson(REPORT_PATH, report)

    console.log('')
    console.log('RESULT: SECOND REAL DEVICE ENROLLMENT CONTRACT IS PROVEN IN THE SANDBOX.')
    console.log('A2 generated its own device identity/keyring/KeyPackage, A1 approved it,')
    console.log('A2 joined via MLS Welcome, replay was a no-op, and enrollment survived restart.')
    console.log('Live Workspace Messenger/account data were not modified.')
    console.log(`Report: ${REPORT_PATH}`)
    console.log('')
  } catch (e) {
    report.finishedAt = now()
    report.summary = {
      result: 'FAIL',
      error: compactError(e),
      liveWorkspaceModified: false,
    }
    try { writeJson(REPORT_PATH, report) } catch {}
    console.error('')
    console.error('SECOND DEVICE ENROLLMENT LAB FAILED:', e?.stack || e)
    console.error(`Report: ${REPORT_PATH}`)
    process.exitCode = 1
  } finally {
    await closeClients(a1, a2)
  }
}

main()
