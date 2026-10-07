import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const LIVE_CLIENT_PATH = path.join(
  PROJECT_ROOT,
  'src',
  'messenger',
  'native-runtime',
  'secure-local-service-client.mjs'
)

const NATIVE_SOURCE_DIR = path.join(__dirname, 'native-source')
const BINARY_SUFFIX = process.platform === 'win32' ? '.exe' : ''
const LAB_BINARY = path.join(
  NATIVE_SOURCE_DIR,
  'target',
  'release',
  `irgeztne-green-lightning-secure-local-service-v04n-lab-l3${BINARY_SUFFIX}`
)

const LAB_ROOT = path.join(
  os.homedir(),
  'Загрузки',
  '_IRGEZTNE_LABS',
  'messenger-device-lab-v03'
)
const DATA_ROOT = path.join(LAB_ROOT, 'data')
const REGISTRY_PATH = path.join(LAB_ROOT, 'device-registry.json')
const REPORT_PATH = path.join(LAB_ROOT, 'last-report.json')
const CONVERSATION_ID = 'device-lab-group-v03'
const KEYRING_PREFIX = 'com.irgeztne.green-lightning.sandbox.device-lab.v03'

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
function shortError(error) {
  return {
    name: String(error?.name || 'Error'),
    code: String(error?.code || ''),
    message: String(error?.message || error || ''),
  }
}
function say(status, name, detail = '') {
  const suffix = detail ? ` — ${detail}` : ''
  console.log(`${status.padEnd(5)} ${name}${suffix}`)
}
function assert(condition, message) {
  if (!condition) throw new Error(message)
}

class DeviceRegistry {
  constructor(file) {
    this.file = file
    this.state = null
  }

  createFresh() {
    const createdAt = now()
    const accounts = []
    const seen = new Set()

    for (const def of DEFINITIONS) {
      if (!seen.has(def.accountId)) {
        seen.add(def.accountId)
        accounts.push({
          accountId: def.accountId,
          label: def.accountLabel,
          status: 'active',
          createdAt,
        })
      }
    }

    this.state = {
      schema: 'irgeztne-messenger-device-registry-lab-v3',
      version: 3,
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
  }

  persist() {
    this.state.updatedAt = now()
    writePrivateJson(this.file, this.state)
  }

  load() {
    this.state = JSON.parse(fs.readFileSync(this.file, 'utf8'))
    return this.state
  }

  getDevice(id) {
    return this.state?.devices?.find((d) => d.deviceId === id) || null
  }

  revoke(id) {
    const device = this.getDevice(id)
    if (!device) throw new Error(`Unknown device ${id}`)
    device.status = 'revoked'
    device.revokedAt = now()
    this.persist()
  }

  assertActive(id) {
    const device = this.getDevice(id)
    if (!device) {
      const error = new Error(`Unknown device ${id}`)
      error.code = 'DEVICE_UNKNOWN'
      throw error
    }
    if (device.status !== 'active') {
      const error = new Error(`Device ${id} is revoked`)
      error.code = 'DEVICE_REVOKED'
      throw error
    }
  }
}

function buildNativeLabBinary() {
  try {
    const version = execFileSync('cargo', ['--version'], { encoding: 'utf8' }).trim()
    say('INFO', 'cargo', version)
  } catch {
    throw new Error(
      'Cargo/Rust toolchain is required for L3 native sandbox build, but cargo was not found in PATH'
    )
  }

  console.log('')
  console.log('Building isolated L3 native binary (live Workspace binary is NOT overwritten)...')
  execFileSync(
    'cargo',
    ['build', '--release', '--locked'],
    {
      cwd: NATIVE_SOURCE_DIR,
      stdio: 'inherit',
      env: process.env,
    }
  )

  assert(fs.existsSync(LAB_BINARY), `L3 native binary missing after cargo build: ${LAB_BINARY}`)
  say('PASS', 'native_lab_build', LAB_BINARY)
}

async function resetLab(deleteRootKey) {
  ensureDir(LAB_ROOT)
  for (const def of DEFINITIONS) {
    try {
      deleteRootKey({
        keyringService: def.keyringService,
        binaryPath: LAB_BINARY,
      })
    } catch {}
  }

  for (const target of [DATA_ROOT, REGISTRY_PATH, REPORT_PATH]) {
    try { fs.rmSync(target, { recursive: true, force: true }) } catch {}
  }

  ensureDir(DATA_ROOT)
}

async function openClients(SecureLocalServiceClient) {
  const clients = new Map()

  for (const def of DEFINITIONS) {
    const client = new SecureLocalServiceClient({
      dataDir: path.join(DATA_ROOT, def.slot),
      identity: def.identity,
      keyringService: def.keyringService,
      binaryPath: LAB_BINARY,
    })
    await client.start()
    clients.set(def.deviceId, client)
  }

  return clients
}

async function closeClients(clients) {
  if (!clients) return
  await Promise.allSettled([...clients.values()].map((client) => client.close()))
}

async function buildGroup(clients) {
  const a1 = clients.get('device-a1')
  const a2 = clients.get('device-a2')
  const b1 = clients.get('device-b1')
  const c1 = clients.get('device-c1')

  await a1.createGroup(CONVERSATION_ID)

  const kpA2 = await a2.keyPackage()
  const addA2 = await a1.addMember(CONVERSATION_ID, kpA2.key_package_hex)
  assert(addA2?.welcome_hex, 'A2 add_member missing welcome_hex')
  await a2.joinGroup(CONVERSATION_ID, addA2.welcome_hex)

  const kpB1 = await b1.keyPackage()
  const addB1 = await a1.addMember(CONVERSATION_ID, kpB1.key_package_hex)
  assert(addB1?.welcome_hex && addB1?.commit_hex, 'B1 add_member missing welcome/commit')
  await a2.applyCommit(CONVERSATION_ID, addB1.commit_hex)
  await b1.joinGroup(CONVERSATION_ID, addB1.welcome_hex)

  const kpC1 = await c1.keyPackage()
  const addC1 = await a1.addMember(CONVERSATION_ID, kpC1.key_package_hex)
  assert(addC1?.welcome_hex && addC1?.commit_hex, 'C1 add_member missing welcome/commit')
  await Promise.all([
    a2.applyCommit(CONVERSATION_ID, addC1.commit_hex),
    b1.applyCommit(CONVERSATION_ID, addC1.commit_hex),
  ])
  await c1.joinGroup(CONVERSATION_ID, addC1.welcome_hex)
}

async function allStatuses(clients) {
  const out = {}
  for (const def of DEFINITIONS) {
    out[def.deviceId] = await clients.get(def.deviceId).groupStatus(CONVERSATION_ID)
  }
  return out
}

async function encryptAndRequire(clients, senderId, recipientIds, plaintext) {
  const encrypted = await clients.get(senderId).encrypt(CONVERSATION_ID, plaintext)
  assert(encrypted?.message_hex, `${senderId} encrypt returned no message_hex`)

  for (const recipientId of recipientIds) {
    const dec = await clients.get(recipientId).decrypt(
      CONVERSATION_ID,
      encrypted.message_hex
    )
    assert(dec?.plaintext === plaintext, `${recipientId} plaintext mismatch`)
  }

  return encrypted.message_hex
}

async function expectDecryptDenied(client, messageHex) {
  try {
    const value = await client.decrypt(CONVERSATION_ID, messageHex)
    return {
      denied: !value?.plaintext,
      returned: value || null,
      error: null,
    }
  } catch (error) {
    return {
      denied: true,
      returned: null,
      error: shortError(error),
    }
  }
}

async function expectEncryptDenied(client, plaintext) {
  try {
    const value = await client.encrypt(CONVERSATION_ID, plaintext)
    return {
      denied: !value?.message_hex,
      returned: value || null,
      error: null,
    }
  } catch (error) {
    return {
      denied: true,
      returned: null,
      error: shortError(error),
    }
  }
}

async function main() {
  if (!fs.existsSync(LIVE_CLIENT_PATH)) {
    throw new Error(`Live JS secure-local-service client missing: ${LIVE_CLIENT_PATH}`)
  }

  buildNativeLabBinary()

  const mod = await import(pathToFileURL(LIVE_CLIENT_PATH).href)
  const { SecureLocalServiceClient, deleteRootKey } = mod
  assert(typeof SecureLocalServiceClient === 'function', 'SecureLocalServiceClient unavailable')
  assert(typeof deleteRootKey === 'function', 'deleteRootKey unavailable')

  const registry = new DeviceRegistry(REGISTRY_PATH)
  let clients = null

  const report = {
    schema: 'irgeztne-messenger-device-lab-l3-report-v1',
    startedAt: now(),
    labRoot: LAB_ROOT,
    projectRoot: PROJECT_ROOT,
    binaryPath: LAB_BINARY,
    conversationId: CONVERSATION_ID,
    tests: [],
  }

  const pass = (name, detail = '') => {
    report.tests.push({ name, status: 'PASS', detail })
    say('PASS', name, detail)
  }

  console.log('')
  console.log('IRGEZTNE Messenger Device Lab v0.3L3')
  console.log(`Sandbox: ${LAB_ROOT}`)
  console.log('Live Workspace Chat, live native binary, live data and live keyring namespace are NOT modified.')
  console.log('')

  try {
    await resetLab(deleteRootKey)
    pass('isolated_l3_reset', 'new v03 data + new v03 keyring namespace')

    registry.createFresh()
    pass('device_registry_create', '3 accounts / 4 devices')

    clients = await openClients(SecureLocalServiceClient)
    pass('native_clients_start', 'A1, A2, Mirror, Camel use L3 sandbox binary')

    const pings = {}
    for (const def of DEFINITIONS) {
      pings[def.deviceId] = await clients.get(def.deviceId).ping()
    }
    report.pings = pings
    const versions = new Set(Object.values(pings).map((p) => String(p?.service_version || '')))
    assert(versions.size === 1 && versions.has('0.4N-LAB-L3'), 'clients did not start the L3 native binary')
    pass('native_binary_identity', 'service_version=0.4N-LAB-L3')

    await buildGroup(clients)
    const before = await allStatuses(clients)
    report.statusBeforeRemove = before

    const groupIds = new Set(
      Object.values(before).map((s) => String(s?.group_id_hex || '')).filter(Boolean)
    )
    assert(groupIds.size === 1, 'four devices do not share one MLS group')
    assert(Object.values(before).every((s) => Number(s?.members) === 4), 'expected 4 MLS members')
    pass('mls_group_bootstrap_4', 'A1 + A2 + Mirror + Camel')

    await encryptAndRequire(
      clients,
      'device-a1',
      ['device-a2', 'device-b1', 'device-c1'],
      `L3 baseline ${crypto.randomUUID()}`
    )
    pass('baseline_group_traffic', 'A1 -> A2 + Mirror + Camel')

    registry.revoke('device-a2')
    assert(registry.getDevice('device-a2')?.status === 'revoked', 'A2 registry revoke failed')
    pass('registry_revoke_a2', 'application gate state persisted')

    let gateDenied = false
    try {
      registry.assertActive('device-a2')
    } catch (error) {
      gateDenied = error?.code === 'DEVICE_REVOKED'
    }
    assert(gateDenied, 'registry gate did not deny A2')
    pass('application_gate_denies_a2')

    const a2Identity = DEFINITIONS.find((d) => d.deviceId === 'device-a2').identity
    const removeResult = await clients.get('device-a1').request('remove_member', {
      conversation_id: CONVERSATION_ID,
      member_identity: a2Identity,
    })
    report.removeResult = removeResult

    assert(removeResult?.commit_hex, 'remove_member returned no commit_hex')
    assert(removeResult?.removed_member_identity === a2Identity, 'remove_member target mismatch')
    assert(Number(removeResult?.members) === 3, 'A1 expected 3 members after remove')
    pass('native_remove_member', `A2 removed by member_identity; epoch=${removeResult.epoch}`)

    // Remaining active members receive and merge the removal commit.
    await Promise.all([
      clients.get('device-b1').applyCommit(CONVERSATION_ID, removeResult.commit_hex),
      clients.get('device-c1').applyCommit(CONVERSATION_ID, removeResult.commit_hex),
    ])
    pass('remaining_members_apply_remove_commit', 'Mirror + Camel entered new epoch')

    // Strong offline-removed-device test: before A2 even receives its removal commit,
    // it must already fail to decrypt traffic from the new epoch.
    const postRemoveCipher = await encryptAndRequire(
      clients,
      'device-a1',
      ['device-b1', 'device-c1'],
      `L3 post-remove offline-A2 ${crypto.randomUUID()}`
    )
    const offlineA2 = await expectDecryptDenied(
      clients.get('device-a2'),
      postRemoveCipher
    )
    report.offlineA2Decrypt = offlineA2
    assert(offlineA2.denied, 'A2 decrypted new epoch traffic while offline from removal commit')
    pass('revoked_device_crypto_denied_offline', 'A2 cannot decrypt new epoch before receiving removal commit')

    // Deliver the removal commit to A2 itself. OpenMLS should mark the local group inactive.
    const a2Apply = await clients.get('device-a2').applyCommit(
      CONVERSATION_ID,
      removeResult.commit_hex
    )
    report.a2ApplyRemoval = a2Apply
    const a2Status = await clients.get('device-a2').groupStatus(CONVERSATION_ID)
    report.a2StatusAfterRemoval = a2Status
    assert(a2Status?.active === false, 'A2 did not become inactive after applying its removal commit')
    assert(Number(a2Status?.members) === 3, 'A2 local post-remove tree expected 3 members')
    pass('removed_device_marks_inactive', 'A2 applied its removal commit; active=false')

    const directA2Send = await expectEncryptDenied(
      clients.get('device-a2'),
      `L3 forbidden A2 send ${crypto.randomUUID()}`
    )
    report.a2DirectSendAfterRemoval = directA2Send
    assert(directA2Send.denied, 'A2 still created MLS application traffic after removal')
    pass('removed_device_native_send_denied', 'OpenMLS blocks A2 even without application gate')

    const activeAfter = {
      a1: await clients.get('device-a1').groupStatus(CONVERSATION_ID),
      b1: await clients.get('device-b1').groupStatus(CONVERSATION_ID),
      c1: await clients.get('device-c1').groupStatus(CONVERSATION_ID),
    }
    report.activeStatusAfterRemoval = activeAfter
    assert(
      [activeAfter.a1, activeAfter.b1, activeAfter.c1].every((s) => s?.active === true && Number(s?.members) === 3),
      'remaining members did not converge to active 3-member group'
    )
    const activeEpochs = new Set(
      [activeAfter.a1, activeAfter.b1, activeAfter.c1].map((s) => Number(s?.epoch))
    )
    assert(activeEpochs.size === 1, 'remaining members disagree on post-remove epoch')
    pass('remaining_group_converges_3', 'A1 + Mirror + Camel active at same epoch')

    await closeClients(clients)
    clients = null
    pass('services_close_for_restart')

    const registryRestarted = new DeviceRegistry(REGISTRY_PATH)
    registryRestarted.load()
    assert(
      registryRestarted.getDevice('device-a2')?.status === 'revoked',
      'A2 registry revoke did not survive restart'
    )
    pass('registry_restart_persistence', 'A2 remains revoked')

    clients = await openClients(SecureLocalServiceClient)

    const restartA1 = await clients.get('device-a1').groupStatus(CONVERSATION_ID)
    const restartB1 = await clients.get('device-b1').groupStatus(CONVERSATION_ID)
    const restartC1 = await clients.get('device-c1').groupStatus(CONVERSATION_ID)
    const restartA2 = await clients.get('device-a2').groupStatus(CONVERSATION_ID)
    report.statusAfterRestart = {
      'device-a1': restartA1,
      'device-a2': restartA2,
      'device-b1': restartB1,
      'device-c1': restartC1,
    }

    assert(restartA2?.active === false, 'A2 became active again after restart')
    assert(
      [restartA1, restartB1, restartC1].every((s) => s?.active === true && Number(s?.members) === 3),
      'remaining group state did not survive restart'
    )
    pass('mls_remove_restart_persistence', 'A2 inactive; A1/Mirror/Camel remain active')

    const postRestartCipher = await encryptAndRequire(
      clients,
      'device-a1',
      ['device-b1', 'device-c1'],
      `L3 post-restart ${crypto.randomUUID()}`
    )
    pass('remaining_group_works_after_restart')

    const a2PostRestart = await expectDecryptDenied(
      clients.get('device-a2'),
      postRestartCipher
    )
    report.a2DecryptAfterRestart = a2PostRestart
    assert(a2PostRestart.denied, 'A2 decrypted post-restart traffic after cryptographic removal')
    pass('revoked_device_stays_crypto_denied_after_restart')

    report.finishedAt = now()
    report.summary = {
      result: 'PASS',
      registryRevoke: true,
      applicationGate: true,
      nativeMlsRemoveMember: true,
      removedDeviceInactive: true,
      removedDeviceDecryptDeniedOffline: true,
      removedDeviceDecryptDeniedAfterRestart: true,
      remainingMembersContinue: true,
      liveWorkspaceModified: false,
    }
    writePrivateJson(REPORT_PATH, report)

    console.log('')
    console.log('RESULT: TRUE MLS DEVICE REMOVAL IS PROVEN IN THE SANDBOX.')
    console.log('A2 is revoked in Device Registry, removed from the MLS tree, cannot send,')
    console.log('cannot decrypt the new epoch, and remains inactive after restart.')
    console.log('Live Workspace Messenger was not patched.')
    console.log(`Report: ${REPORT_PATH}`)
    console.log('')
  } catch (error) {
    report.finishedAt = now()
    report.summary = {
      result: 'FAIL',
      error: shortError(error),
      liveWorkspaceModified: false,
    }
    try { writePrivateJson(REPORT_PATH, report) } catch {}
    console.error('')
    console.error('DEVICE LAB L3 FAILED:', error?.stack || error)
    console.error(`Report: ${REPORT_PATH}`)
    process.exitCode = 1
  } finally {
    await closeClients(clients)
  }
}

main()
