import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const RUNTIME_DIR = path.join(PROJECT_ROOT, 'src', 'messenger', 'native-runtime')
const CLIENT_PATH = path.join(RUNTIME_DIR, 'secure-local-service-client.mjs')
const BINARY_SUFFIX = process.platform === 'win32' ? '.exe' : ''
const BINARY_PATH = path.join(
  RUNTIME_DIR,
  `irgeztne-green-lightning-secure-local-service-v04n${BINARY_SUFFIX}`
)
const LAB_ROOT = path.join(os.homedir(), 'Загрузки', '_IRGEZTNE_LABS', 'messenger-device-lab-v01')
const DATA_ROOT = path.join(LAB_ROOT, 'data')
const REGISTRY_PATH = path.join(LAB_ROOT, 'device-registry.json')
const REPORT_PATH = path.join(LAB_ROOT, 'last-report.json')
const CONVERSATION_ID = 'device-lab-group-v01'
const KEYRING_PREFIX = 'com.irgeztne.green-lightning.sandbox.device-lab.v01'

const DEFINITIONS = [
  { accountId: 'account-a', accountLabel: 'You', deviceId: 'device-a1', deviceLabel: 'Primary', slot: 'a1' },
  { accountId: 'account-a', accountLabel: 'You', deviceId: 'device-a2', deviceLabel: 'Second device', slot: 'a2' },
  { accountId: 'account-b', accountLabel: 'Mirror', deviceId: 'device-b1', deviceLabel: 'Mirror device', slot: 'b1' },
  { accountId: 'account-c', accountLabel: 'Camel', deviceId: 'device-c1', deviceLabel: 'Camel device', slot: 'c1' },
].map((item) => ({
  ...item,
  identity: `sandbox/${item.accountId}/${item.deviceId}`,
  keyringService: `${KEYRING_PREFIX}.${item.slot}`,
}))

function now() { return new Date().toISOString() }
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }) }
function writePrivateJson(file, value) {
  ensureDir(path.dirname(file))
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 })
  try { fs.chmodSync(file, 0o600) } catch {}
}

class DeviceRegistry {
  constructor(file) {
    this.file = file
    this.state = null
  }

  createFresh() {
    const createdAt = now()
    const accounts = []
    const accountSeen = new Set()
    for (const def of DEFINITIONS) {
      if (!accountSeen.has(def.accountId)) {
        accountSeen.add(def.accountId)
        accounts.push({
          accountId: def.accountId,
          label: def.accountLabel,
          status: 'active',
          createdAt,
        })
      }
    }
    this.state = {
      schema: 'irgeztne-messenger-device-registry-lab-v1',
      version: 1,
      createdAt,
      updatedAt: createdAt,
      accounts,
      devices: DEFINITIONS.map((def) => ({
        accountId: def.accountId,
        deviceId: def.deviceId,
        label: def.deviceLabel,
        identity: def.identity,
        status: 'active',
        createdAt,
        revokedAt: null,
      })),
    }
    this.persist()
    return this.state
  }

  load() {
    const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'))
    if (!parsed || parsed.schema !== 'irgeztne-messenger-device-registry-lab-v1' || !Array.isArray(parsed.devices)) {
      throw new Error('Device registry schema mismatch')
    }
    this.state = parsed
    return this.state
  }

  persist() {
    if (!this.state) throw new Error('registry not initialized')
    this.state.updatedAt = now()
    writePrivateJson(this.file, this.state)
  }

  getDevice(deviceId) {
    if (!this.state) throw new Error('registry not loaded')
    return this.state.devices.find((d) => d.deviceId === deviceId) || null
  }

  assertActive(deviceId) {
    const device = this.getDevice(deviceId)
    if (!device) {
      const error = new Error(`Unknown device: ${deviceId}`)
      error.code = 'DEVICE_UNKNOWN'
      throw error
    }
    if (device.status !== 'active') {
      const error = new Error(`Device ${deviceId} is revoked`)
      error.code = 'DEVICE_REVOKED'
      throw error
    }
    return device
  }

  revoke(deviceId) {
    const device = this.getDevice(deviceId)
    if (!device) throw new Error(`Unknown device: ${deviceId}`)
    device.status = 'revoked'
    device.revokedAt = now()
    this.persist()
    return device
  }
}

function line(label, value = '') {
  const suffix = value === '' ? '' : ` ${value}`
  console.log(`${label}${suffix}`)
}

function testRecorder() {
  const tests = []
  return {
    pass(name, detail = '') {
      tests.push({ name, status: 'PASS', detail })
      line(`PASS  ${name}`, detail ? `— ${detail}` : '')
    },
    info(name, detail = '') {
      tests.push({ name, status: 'INFO', detail })
      line(`INFO  ${name}`, detail ? `— ${detail}` : '')
    },
    gap(name, detail = '') {
      tests.push({ name, status: 'KNOWN_GAP', detail })
      line(`GAP   ${name}`, detail ? `— ${detail}` : '')
    },
    fail(name, error) {
      const detail = String(error?.stack || error?.message || error || '')
      tests.push({ name, status: 'FAIL', detail })
      line(`FAIL  ${name}`, `— ${String(error?.message || error)}`)
    },
    list: tests,
  }
}

async function openClients(SecureLocalServiceClient, binaryPath) {
  const map = new Map()
  for (const def of DEFINITIONS) {
    const client = new SecureLocalServiceClient({
      dataDir: path.join(DATA_ROOT, def.slot),
      identity: def.identity,
      keyringService: def.keyringService,
      binaryPath,
    })
    await client.start()
    map.set(def.deviceId, client)
  }
  return map
}

async function closeClients(clients) {
  if (!clients) return
  await Promise.allSettled([...clients.values()].map((client) => client.close()))
}

async function resetLab(deleteRootKey, binaryPath) {
  ensureDir(LAB_ROOT)
  for (const def of DEFINITIONS) {
    try {
      deleteRootKey({ keyringService: def.keyringService, binaryPath })
    } catch {}
  }
  try { fs.rmSync(DATA_ROOT, { recursive: true, force: true }) } catch {}
  try { fs.rmSync(REGISTRY_PATH, { force: true }) } catch {}
  try { fs.rmSync(REPORT_PATH, { force: true }) } catch {}
  ensureDir(DATA_ROOT)
}

async function buildFourMemberGroup(clients) {
  const a1 = clients.get('device-a1')
  const a2 = clients.get('device-a2')
  const b1 = clients.get('device-b1')
  const c1 = clients.get('device-c1')

  await a1.createGroup(CONVERSATION_ID)

  const kpA2 = await a2.keyPackage()
  const addA2 = await a1.addMember(CONVERSATION_ID, kpA2.key_package_hex)
  if (!addA2?.welcome_hex) throw new Error('A2 add_member missing welcome_hex')
  await a2.joinGroup(CONVERSATION_ID, addA2.welcome_hex)

  const kpB1 = await b1.keyPackage()
  const addB1 = await a1.addMember(CONVERSATION_ID, kpB1.key_package_hex)
  if (!addB1?.welcome_hex || !addB1?.commit_hex) throw new Error('B1 add_member missing welcome_hex/commit_hex')
  await a2.applyCommit(CONVERSATION_ID, addB1.commit_hex)
  await b1.joinGroup(CONVERSATION_ID, addB1.welcome_hex)

  const kpC1 = await c1.keyPackage()
  const addC1 = await a1.addMember(CONVERSATION_ID, kpC1.key_package_hex)
  if (!addC1?.welcome_hex || !addC1?.commit_hex) throw new Error('C1 add_member missing welcome_hex/commit_hex')
  await Promise.all([
    a2.applyCommit(CONVERSATION_ID, addC1.commit_hex),
    b1.applyCommit(CONVERSATION_ID, addC1.commit_hex),
  ])
  await c1.joinGroup(CONVERSATION_ID, addC1.welcome_hex)
}

async function statuses(clients) {
  const out = {}
  for (const def of DEFINITIONS) {
    out[def.deviceId] = await clients.get(def.deviceId).groupStatus(CONVERSATION_ID)
  }
  return out
}

function groupIdSet(statusMap) {
  return new Set(Object.values(statusMap).map((s) => String(s?.group_id_hex || '')).filter(Boolean))
}

async function gatedSend({ registry, clients, senderDeviceId, plaintext }) {
  registry.assertActive(senderDeviceId)
  const sender = clients.get(senderDeviceId)
  if (!sender) throw new Error(`Missing service client for ${senderDeviceId}`)
  const encrypted = await sender.encrypt(CONVERSATION_ID, plaintext)
  if (!encrypted?.message_hex) throw new Error('encrypt returned no message_hex')

  const received = []
  for (const def of DEFINITIONS) {
    if (def.deviceId === senderDeviceId) continue
    const recipient = clients.get(def.deviceId)
    const decrypted = await recipient.decrypt(CONVERSATION_ID, encrypted.message_hex)
    if (!decrypted || decrypted.plaintext !== plaintext) {
      throw new Error(`decrypt mismatch at ${def.deviceId}`)
    }
    received.push(def.deviceId)
  }
  return { ciphertext: encrypted.message_hex, received }
}

async function main() {
  if (!fs.existsSync(CLIENT_PATH)) {
    throw new Error(`Secure local service client missing: ${CLIENT_PATH}`)
  }

  const module = await import(pathToFileURL(CLIENT_PATH).href)
  const { SecureLocalServiceClient, deleteRootKey } = module
  if (typeof SecureLocalServiceClient !== 'function') throw new Error('SecureLocalServiceClient unavailable')
  if (typeof deleteRootKey !== 'function') throw new Error('deleteRootKey unavailable')

  // L1a: follow the exact live Workspace Messenger contract.
  // messenger-main.cjs receives runtimeDir=src/messenger/native-runtime and
  // loads the native binary directly from that directory.
  const binaryPath = BINARY_PATH
  if (!fs.existsSync(binaryPath)) {
    throw new Error(
      `Live Workspace secure-local-service binary missing: ${binaryPath}`
    )
  }

  const T = testRecorder()
  let clients = null
  const registry = new DeviceRegistry(REGISTRY_PATH)
  const report = {
    schema: 'irgeztne-messenger-device-lab-report-v1',
    startedAt: now(),
    projectRoot: PROJECT_ROOT,
    labRoot: LAB_ROOT,
    binaryPath,
    conversationId: CONVERSATION_ID,
    tests: T.list,
  }

  line('')
  line('IRGEZTNE Messenger Device Lab v0.1L1a')
  line('Sandbox:', LAB_ROOT)
  line('Main Workspace data is NOT used.')
  line('')

  try {
    await resetLab(deleteRootKey, binaryPath)
    T.pass('isolated_lab_reset', 'separate data + separate keyring namespace')

    registry.createFresh()
    T.pass('device_registry_create', '3 accounts / 4 devices')

    clients = await openClients(SecureLocalServiceClient, binaryPath)
    T.pass('native_clients_start', 'A1, A2, Mirror, Camel')

    const security = await Promise.all([...clients.entries()].map(async ([deviceId, client]) => [deviceId, await client.securityStatus()]))
    const badSecurity = security.filter(([, status]) => !status || typeof status !== 'object')
    if (badSecurity.length) throw new Error('security_status missing for one or more devices')
    T.pass('native_security_status', 'all four secure-local-service clients responded')

    await buildFourMemberGroup(clients)
    const firstStatus = await statuses(clients)
    const ids = groupIdSet(firstStatus)
    if (ids.size !== 1) throw new Error(`four-member MLS group id mismatch: ${[...ids].join(', ')}`)
    const groupId = [...ids][0]
    T.pass('mls_group_bootstrap_4', `group=${groupId.slice(0, 24)}…`)

    const msg1 = `A1 hello ${crypto.randomUUID()}`
    const send1 = await gatedSend({ registry, clients, senderDeviceId: 'device-a1', plaintext: msg1 })
    if (send1.received.length !== 3) throw new Error('A1 delivery did not reach all three recipients')
    T.pass('active_device_send', 'A1 -> A2 + Mirror + Camel')

    const msg2 = `A2 before revoke ${crypto.randomUUID()}`
    await gatedSend({ registry, clients, senderDeviceId: 'device-a2', plaintext: msg2 })
    T.pass('second_device_send_before_revoke', 'A2 authorized while active')

    registry.revoke('device-a2')
    T.pass('registry_revoke_device', 'A2 status=revoked persisted')

    let blocked = false
    try {
      await gatedSend({ registry, clients, senderDeviceId: 'device-a2', plaintext: 'must not send' })
    } catch (error) {
      if (error?.code === 'DEVICE_REVOKED') blocked = true
      else throw error
    }
    if (!blocked) throw new Error('revoked A2 was not blocked by registry gate')
    T.pass('revoked_device_send_denied', 'A2 blocked before crypto operation')

    await gatedSend({ registry, clients, senderDeviceId: 'device-a1', plaintext: `A1 after revoke ${crypto.randomUUID()}` })
    T.pass('other_device_continues', 'A1 remains active after A2 registry revoke')

    // Deliberately bypass the application registry gate to measure the real MLS state.
    const rawProbe = await clients.get('device-a1').encrypt(CONVERSATION_ID, `raw revoke probe ${crypto.randomUUID()}`)
    let revokedCanStillDecrypt = false
    try {
      const raw = await clients.get('device-a2').decrypt(CONVERSATION_ID, rawProbe.message_hex)
      revokedCanStillDecrypt = Boolean(raw?.plaintext)
    } catch {
      revokedCanStillDecrypt = false
    }

    const removeMemberExposed = typeof clients.get('device-a1').removeMember === 'function'
    if (revokedCanStillDecrypt) {
      T.gap(
        'cryptographic_member_removal',
        removeMemberExposed
          ? 'A2 still decrypts; removeMember exists but is not wired into this lab yet'
          : 'A2 still decrypts because current host-client contract exposes no removeMember operation'
      )
    } else {
      T.info('cryptographic_member_removal', 'A2 could not decrypt after revoke (unexpectedly stronger than current host-client contract implies)')
    }

    await closeClients(clients)
    clients = null
    T.pass('services_close_for_restart', 'all native clients closed cleanly')

    const registry2 = new DeviceRegistry(REGISTRY_PATH)
    registry2.load()
    if (registry2.getDevice('device-a2')?.status !== 'revoked') throw new Error('A2 revoke state did not persist')
    T.pass('registry_restart_persistence', 'A2 remains revoked')

    clients = await openClients(SecureLocalServiceClient, binaryPath)
    const restartStatus = await statuses(clients)
    const restartIds = groupIdSet(restartStatus)
    if (restartIds.size !== 1 || !restartIds.has(groupId)) {
      throw new Error('MLS group state did not survive native service restart')
    }
    T.pass('mls_restart_persistence', 'all four devices reopened same MLS group')

    let restartBlocked = false
    try {
      await gatedSend({ registry: registry2, clients, senderDeviceId: 'device-a2', plaintext: 'still blocked after restart' })
    } catch (error) {
      if (error?.code === 'DEVICE_REVOKED') restartBlocked = true
      else throw error
    }
    if (!restartBlocked) throw new Error('A2 revoke gate lost after restart')
    T.pass('revoked_device_stays_denied_after_restart')

    await gatedSend({ registry: registry2, clients, senderDeviceId: 'device-a1', plaintext: `post-restart ${crypto.randomUUID()}` })
    T.pass('active_device_send_after_restart', 'A1 still communicates')

    report.finishedAt = now()
    report.summary = {
      pass: T.list.filter((t) => t.status === 'PASS').length,
      fail: T.list.filter((t) => t.status === 'FAIL').length,
      knownGap: T.list.filter((t) => t.status === 'KNOWN_GAP').length,
      info: T.list.filter((t) => t.status === 'INFO').length,
      cryptographicRemoveMemberExposed: removeMemberExposed,
      revokedDeviceRawDecryptAfterRegistryRevoke: revokedCanStillDecrypt,
    }
    writePrivateJson(REPORT_PATH, report)

    line('')
    line('RESULT: Device Registry + application revoke gate are PROVEN in sandbox.')
    if (revokedCanStillDecrypt) {
      line('NEXT: native MLS remove-member/revoke must be added and proven here BEFORE Workspace integration.')
    } else {
      line('NEXT: inspect why cryptographic access disappeared and formalize remove-member semantics before integration.')
    }
    line('Report:', REPORT_PATH)
    line('')
  } catch (error) {
    T.fail('lab_run', error)
    report.finishedAt = now()
    report.summary = {
      pass: T.list.filter((t) => t.status === 'PASS').length,
      fail: T.list.filter((t) => t.status === 'FAIL').length,
      knownGap: T.list.filter((t) => t.status === 'KNOWN_GAP').length,
      info: T.list.filter((t) => t.status === 'INFO').length,
    }
    try { writePrivateJson(REPORT_PATH, report) } catch {}
    throw error
  } finally {
    await closeClients(clients)
  }
}

main().catch((error) => {
  console.error('')
  console.error('DEVICE LAB FAILED:', error?.stack || error)
  process.exitCode = 1
})
