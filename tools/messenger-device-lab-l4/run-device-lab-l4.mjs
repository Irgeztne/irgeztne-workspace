import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

import { createSecureLocalServiceClientL4 } from './secure-local-service-client-l4.mjs'
import { DeviceRevocationCoordinatorL4 } from './device-revocation-coordinator-l4.mjs'

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
  `irgeztne-green-lightning-secure-local-service-v04n-lab-l4${BINARY_SUFFIX}`
)

const LAB_ROOT = path.join(
  os.homedir(),
  'Загрузки',
  '_IRGEZTNE_LABS',
  'messenger-device-lab-v04'
)
const DATA_ROOT = path.join(LAB_ROOT, 'data')
const REGISTRY_PATH = path.join(LAB_ROOT, 'device-registry.json')
const REPORT_PATH = path.join(LAB_ROOT, 'last-report.json')
const CONVERSATION_ID = 'device-lab-group-v04'
const KEYRING_PREFIX = 'com.irgeztne.green-lightning.sandbox.device-lab.v04'

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
function compactError(error) {
  return {
    name: String(error?.name || 'Error'),
    code: String(error?.code || ''),
    message: String(error?.message || error || ''),
  }
}
function say(status, name, detail = '') {
  console.log(`${status.padEnd(5)} ${name}${detail ? ` — ${detail}` : ''}`)
}
function assert(value, message) {
  if (!value) throw new Error(message)
}
async function expectCode(fn, code) {
  try {
    await fn()
    return false
  } catch (error) {
    return error?.code === code
  }
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
      schema: 'irgeztne-messenger-device-registry-lab-v4',
      version: 4,
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
        memberships: [CONVERSATION_ID],
        mlsRemoval: {
          status: 'active',
          conversationId: CONVERSATION_ID,
          removedAt: null,
          epoch: null,
          members: 4,
          nativeResult: null,
          lastError: null,
        },
      })),
    }
    this.persist()
  }

  load() {
    this.state = JSON.parse(fs.readFileSync(this.file, 'utf8'))
    return this.state
  }

  persist() {
    this.state.updatedAt = now()
    writePrivateJson(this.file, this.state)
  }

  getDevice(deviceId) {
    return this.state?.devices?.find((d) => d.deviceId === deviceId) || null
  }

  assertActive(deviceId) {
    const device = this.getDevice(deviceId)
    if (!device) {
      const error = new Error(`Unknown device ${deviceId}`)
      error.code = 'DEVICE_UNKNOWN'
      throw error
    }
    if (device.status !== 'active') {
      const error = new Error(`Device ${deviceId} is not active`)
      error.code = 'DEVICE_REVOKED'
      throw error
    }
  }

  beginRevoke(deviceId, conversationId) {
    const device = this.getDevice(deviceId)
    if (!device) throw new Error(`Unknown device ${deviceId}`)

    const snapshot = JSON.parse(JSON.stringify(device))
    device.status = 'revoking'
    device.mlsRemoval = {
      ...(device.mlsRemoval || {}),
      status: 'pending',
      conversationId,
      lastError: null,
    }
    this.persist()
    return snapshot
  }

  completeRevoke(deviceId, conversationId, details) {
    const device = this.getDevice(deviceId)
    if (!device) throw new Error(`Unknown device ${deviceId}`)

    device.status = 'revoked'
    device.revokedAt = device.revokedAt || now()
    device.mlsRemoval = {
      status: 'removed',
      conversationId,
      removedAt: now(),
      epoch: Number(details.epoch),
      members: Number(details.members),
      nativeResult: String(details.nativeResult),
      lastError: null,
    }
    this.persist()
  }

  failRevoke(deviceId, conversationId, error) {
    const device = this.getDevice(deviceId)
    if (!device) return

    // Fail closed at the application gate: revoking is not allowed to send.
    device.status = 'revoking'
    device.mlsRemoval = {
      ...(device.mlsRemoval || {}),
      status: 'failed',
      conversationId,
      lastError: compactError(error),
    }
    this.persist()
  }

  simulateInterruptedAfterNativeRemoval(deviceId, conversationId) {
    const device = this.getDevice(deviceId)
    if (!device) throw new Error(`Unknown device ${deviceId}`)

    device.status = 'revoking'
    device.mlsRemoval = {
      status: 'pending',
      conversationId,
      removedAt: null,
      epoch: null,
      members: null,
      nativeResult: null,
      lastError: null,
    }
    this.persist()
  }
}

function buildNativeLabBinary() {
  const version = execFileSync('cargo', ['--version'], { encoding: 'utf8' }).trim()
  say('INFO', 'cargo', version)

  console.log('')
  console.log('Building isolated L4 native binary (live Workspace binary is NOT overwritten)...')
  execFileSync(
    'cargo',
    ['build', '--release', '--locked'],
    {
      cwd: NATIVE_SOURCE_DIR,
      stdio: 'inherit',
      env: process.env,
    }
  )

  assert(fs.existsSync(LAB_BINARY), `L4 native binary missing: ${LAB_BINARY}`)
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

async function openClients(ClientClass) {
  const clients = new Map()
  for (const def of DEFINITIONS) {
    const client = new ClientClass({
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
  await Promise.allSettled([...clients.values()].map((c) => c.close()))
}

async function buildGroup(clients) {
  const a1 = clients.get('device-a1')
  const a2 = clients.get('device-a2')
  const b1 = clients.get('device-b1')
  const c1 = clients.get('device-c1')

  await a1.createGroup(CONVERSATION_ID)

  const kpA2 = await a2.keyPackage()
  const addA2 = await a1.addMember(CONVERSATION_ID, kpA2.key_package_hex)
  assert(addA2?.welcome_hex, 'A2 welcome missing')
  await a2.joinGroup(CONVERSATION_ID, addA2.welcome_hex)

  const kpB1 = await b1.keyPackage()
  const addB1 = await a1.addMember(CONVERSATION_ID, kpB1.key_package_hex)
  assert(addB1?.welcome_hex && addB1?.commit_hex, 'B1 welcome/commit missing')
  await a2.applyCommit(CONVERSATION_ID, addB1.commit_hex)
  await b1.joinGroup(CONVERSATION_ID, addB1.welcome_hex)

  const kpC1 = await c1.keyPackage()
  const addC1 = await a1.addMember(CONVERSATION_ID, kpC1.key_package_hex)
  assert(addC1?.welcome_hex && addC1?.commit_hex, 'C1 welcome/commit missing')
  await Promise.all([
    a2.applyCommit(CONVERSATION_ID, addC1.commit_hex),
    b1.applyCommit(CONVERSATION_ID, addC1.commit_hex),
  ])
  await c1.joinGroup(CONVERSATION_ID, addC1.welcome_hex)
}

async function encryptAndRequire(clients, senderId, recipientIds, plaintext) {
  const encrypted = await clients.get(senderId).encrypt(CONVERSATION_ID, plaintext)
  assert(encrypted?.message_hex, 'encrypt returned no message_hex')
  for (const id of recipientIds) {
    const dec = await clients.get(id).decrypt(CONVERSATION_ID, encrypted.message_hex)
    assert(dec?.plaintext === plaintext, `${id} decrypt mismatch`)
  }
  return encrypted.message_hex
}

async function decryptDenied(client, messageHex) {
  try {
    const result = await client.decrypt(CONVERSATION_ID, messageHex)
    return !result?.plaintext
  } catch {
    return true
  }
}

async function nativeSendDenied(client) {
  try {
    const result = await client.encrypt(
      CONVERSATION_ID,
      `forbidden ${crypto.randomUUID()}`
    )
    return !result?.message_hex
  } catch {
    return true
  }
}

async function main() {
  if (!fs.existsSync(LIVE_CLIENT_PATH)) {
    throw new Error(`Live base client missing: ${LIVE_CLIENT_PATH}`)
  }

  buildNativeLabBinary()

  const live = await import(pathToFileURL(LIVE_CLIENT_PATH).href)
  const BaseClient = live.SecureLocalServiceClient
  const deleteRootKey = live.deleteRootKey
  assert(typeof BaseClient === 'function', 'SecureLocalServiceClient unavailable')
  assert(typeof deleteRootKey === 'function', 'deleteRootKey unavailable')

  const ClientL4 = createSecureLocalServiceClientL4(BaseClient)
  assert(typeof ClientL4.prototype.removeMember === 'function', 'public removeMember method missing')

  const report = {
    schema: 'irgeztne-messenger-device-lab-l4-report-v1',
    startedAt: now(),
    projectRoot: PROJECT_ROOT,
    labRoot: LAB_ROOT,
    binaryPath: LAB_BINARY,
    conversationId: CONVERSATION_ID,
    tests: [],
  }

  const pass = (name, detail = '') => {
    report.tests.push({ name, status: 'PASS', detail })
    say('PASS', name, detail)
  }

  let clients = null
  const registry = new DeviceRegistry(REGISTRY_PATH)

  console.log('')
  console.log('IRGEZTNE Messenger Device Lab v0.4L4')
  console.log(`Sandbox: ${LAB_ROOT}`)
  console.log('Live Chat, live native binary, live Messenger data and live keyring are NOT modified.')
  console.log('')

  try {
    await resetLab(deleteRootKey)
    pass('isolated_l4_reset', 'new v04 data + v04 keyring namespace')

    registry.createFresh()
    pass('device_registry_create', '3 accounts / 4 devices with membership records')

    clients = await openClients(ClientL4)
    pass('native_clients_start', 'A1, A2, Mirror, Camel')

    const versions = new Set()
    for (const def of DEFINITIONS) {
      const ping = await clients.get(def.deviceId).ping()
      versions.add(String(ping?.service_version || ''))
    }
    assert(versions.size === 1 && versions.has('0.4N-LAB-L4'), 'wrong native binary identity')
    pass('native_binary_identity', 'service_version=0.4N-LAB-L4')

    assert(
      await expectCode(
        () => clients.get('device-a1').removeMember('', 'x'),
        'INVALID_CONVERSATION_ID'
      ),
      'removeMember did not validate conversationId locally'
    )
    assert(
      await expectCode(
        () => clients.get('device-a1').removeMember(CONVERSATION_ID, ''),
        'INVALID_MEMBER_IDENTITY'
      ),
      'removeMember did not validate memberIdentity locally'
    )
    pass('public_remove_member_validation', 'bad arguments rejected before IPC')

    await buildGroup(clients)
    pass('mls_group_bootstrap_4', 'A1 + A2 + Mirror + Camel')

    await encryptAndRequire(
      clients,
      'device-a1',
      ['device-a2', 'device-b1', 'device-c1'],
      `L4 baseline ${crypto.randomUUID()}`
    )
    pass('baseline_group_traffic')

    const coordinator = new DeviceRevocationCoordinatorL4({ registry })
    const a1Identity = DEFINITIONS.find((d) => d.deviceId === 'device-a1').identity

    assert(
      await expectCode(
        () => coordinator.revokeDevice({
          initiatorClient: clients.get('device-a1'),
          initiatorIdentity: a1Identity,
          conversationId: CONVERSATION_ID,
          deviceId: 'device-does-not-exist',
        }),
        'DEVICE_UNKNOWN'
      ),
      'unknown device did not fail before crypto'
    )
    pass('unknown_device_revoke_denied', 'DEVICE_UNKNOWN before crypto')

    assert(
      await expectCode(
        () => coordinator.revokeDevice({
          initiatorClient: clients.get('device-a1'),
          initiatorIdentity: a1Identity,
          conversationId: CONVERSATION_ID,
          deviceId: 'device-a1',
        }),
        'SELF_REVOKE_DENIED'
      ),
      'self revoke was not denied by coordinator'
    )
    pass('self_revoke_denied', 'current initiating device cannot revoke itself')

    let removeCalls = 0
    const realRemoveMember = clients.get('device-a1').removeMember.bind(clients.get('device-a1'))
    clients.get('device-a1').removeMember = async (...args) => {
      removeCalls += 1
      return realRemoveMember(...args)
    }

    const revoke = await coordinator.revokeDevice({
      initiatorClient: clients.get('device-a1'),
      initiatorIdentity: a1Identity,
      conversationId: CONVERSATION_ID,
      deviceId: 'device-a2',
    })
    report.firstRevoke = revoke

    assert(revoke.result === 'REVOKED', 'first revoke did not return REVOKED')
    assert(typeof revoke.commitHex === 'string' && revoke.commitHex.length > 2, 'first revoke missing commit')
    assert(removeCalls === 1, 'first revoke expected exactly one native removeMember call')
    assert(registry.getDevice('device-a2')?.status === 'revoked', 'registry did not finalize revoked')
    pass('coordinated_revoke_a2', `REVOKED epoch=${revoke.epoch}`)

    await Promise.all([
      clients.get('device-b1').applyCommit(CONVERSATION_ID, revoke.commitHex),
      clients.get('device-c1').applyCommit(CONVERSATION_ID, revoke.commitHex),
    ])
    pass('remaining_members_apply_remove_commit')

    const postRemoveCipher = await encryptAndRequire(
      clients,
      'device-a1',
      ['device-b1', 'device-c1'],
      `L4 post remove ${crypto.randomUUID()}`
    )
    assert(
      await decryptDenied(clients.get('device-a2'), postRemoveCipher),
      'A2 decrypted new epoch traffic'
    )
    pass('revoked_device_crypto_denied_offline')

    await clients.get('device-a2').applyCommit(CONVERSATION_ID, revoke.commitHex)
    const a2Status = await clients.get('device-a2').groupStatus(CONVERSATION_ID)
    assert(a2Status?.active === false, 'A2 did not become inactive')
    assert(await nativeSendDenied(clients.get('device-a2')), 'A2 native send still works')
    pass('removed_device_inactive_and_native_send_denied')

    // Direct public API retry: stable native no-op, not a second group mutation.
    const a1BeforeRetry = await clients.get('device-a1').groupStatus(CONVERSATION_ID)
    const nativeRetry = await realRemoveMember(
      CONVERSATION_ID,
      DEFINITIONS.find((d) => d.deviceId === 'device-a2').identity
    )
    const a1AfterRetry = await clients.get('device-a1').groupStatus(CONVERSATION_ID)
    report.nativeRetry = nativeRetry
    assert(nativeRetry.result === 'NOT_PRESENT', 'repeat removeMember did not return NOT_PRESENT')
    assert(nativeRetry.commitHex === null, 'NOT_PRESENT unexpectedly returned a commit')
    assert(Number(a1AfterRetry.epoch) === Number(a1BeforeRetry.epoch), 'repeat remove changed epoch')
    assert(Number(a1AfterRetry.members) === Number(a1BeforeRetry.members), 'repeat remove changed member count')
    pass('public_remove_member_idempotent_noop', 'NOT_PRESENT; epoch/member count unchanged')

    // Simulate a crash window: crypto removal completed, but Registry persisted only "revoking".
    registry.simulateInterruptedAfterNativeRemoval('device-a2', CONVERSATION_ID)
    registry.assertActive = registry.assertActive.bind(registry)
    let gateDenied = false
    try {
      registry.assertActive('device-a2')
    } catch (error) {
      gateDenied = error?.code === 'DEVICE_REVOKED'
    }
    assert(gateDenied, 'revoking device was not fail-closed at application gate')
    pass('revoking_state_is_fail_closed')

    const recovery = await coordinator.revokeDevice({
      initiatorClient: clients.get('device-a1'),
      initiatorIdentity: a1Identity,
      conversationId: CONVERSATION_ID,
      deviceId: 'device-a2',
    })
    report.recoveryRevoke = recovery
    assert(recovery.result === 'RECOVERED_ALREADY_REMOVED', 'interrupted retry did not recover')
    assert(removeCalls === 2, 'recovery should perform one native retry')
    assert(registry.getDevice('device-a2')?.status === 'revoked', 'recovery did not finalize registry')
    pass('interrupted_revoke_recovery', 'native NOT_PRESENT + known Registry membership -> finalized')

    const already = await coordinator.revokeDevice({
      initiatorClient: clients.get('device-a1'),
      initiatorIdentity: a1Identity,
      conversationId: CONVERSATION_ID,
      deviceId: 'device-a2',
    })
    report.alreadyRevoke = already
    assert(already.result === 'ALREADY_REVOKED', 'final repeat revoke did not return ALREADY_REVOKED')
    assert(removeCalls === 2, 'ALREADY_REVOKED should not call native removeMember again')
    pass('repeated_revoke_application_noop', 'ALREADY_REVOKED; zero native mutation')

    const activeStatuses = await Promise.all(
      ['device-a1', 'device-b1', 'device-c1'].map((id) =>
        clients.get(id).groupStatus(CONVERSATION_ID)
      )
    )
    assert(
      activeStatuses.every((s) => s?.active === true && Number(s?.members) === 3),
      'remaining group did not converge to 3 active members'
    )
    const epochs = new Set(activeStatuses.map((s) => Number(s?.epoch)))
    assert(epochs.size === 1, 'remaining members disagree on epoch')
    pass('remaining_group_converges_3')

    await closeClients(clients)
    clients = null
    pass('services_close_for_restart')

    const registryRestart = new DeviceRegistry(REGISTRY_PATH)
    registryRestart.load()
    assert(registryRestart.getDevice('device-a2')?.status === 'revoked', 'registry revoke lost after restart')
    assert(registryRestart.getDevice('device-a2')?.mlsRemoval?.status === 'removed', 'MLS removal record lost')
    pass('registry_restart_persistence')

    clients = await openClients(ClientL4)
    const restartA2 = await clients.get('device-a2').groupStatus(CONVERSATION_ID)
    assert(restartA2?.active === false, 'A2 became active after restart')

    const restartCipher = await encryptAndRequire(
      clients,
      'device-a1',
      ['device-b1', 'device-c1'],
      `L4 restart ${crypto.randomUUID()}`
    )
    assert(await decryptDenied(clients.get('device-a2'), restartCipher), 'A2 decrypted after restart')
    pass('mls_remove_restart_persistence', 'A2 inactive and crypto-denied')

    const coordinatorRestart = new DeviceRevocationCoordinatorL4({ registry: registryRestart })
    let restartRemoveCalls = 0
    const restartRealRemove = clients.get('device-a1').removeMember.bind(clients.get('device-a1'))
    clients.get('device-a1').removeMember = async (...args) => {
      restartRemoveCalls += 1
      return restartRealRemove(...args)
    }

    const afterRestartRepeat = await coordinatorRestart.revokeDevice({
      initiatorClient: clients.get('device-a1'),
      initiatorIdentity: a1Identity,
      conversationId: CONVERSATION_ID,
      deviceId: 'device-a2',
    })
    assert(afterRestartRepeat.result === 'ALREADY_REVOKED', 'restart repeat not ALREADY_REVOKED')
    assert(restartRemoveCalls === 0, 'restart repeat unexpectedly touched native MLS')
    pass('repeated_revoke_after_restart_noop', 'ALREADY_REVOKED; native calls=0')

    report.finishedAt = now()
    report.summary = {
      result: 'PASS',
      publicRemoveMemberContract: true,
      deviceRegistryCoordinator: true,
      nativeRemoveIdempotentNoop: true,
      interruptedRevokeRecovery: true,
      repeatedRevokeNoop: true,
      unknownDeviceDenied: true,
      selfRevokeDenied: true,
      revokedDeviceCryptoDenied: true,
      restartPersistence: true,
      liveWorkspaceModified: false,
    }
    writePrivateJson(REPORT_PATH, report)

    console.log('')
    console.log('RESULT: ACCOUNT↔DEVICE REVOCATION CONTRACT IS PROVEN IN THE SANDBOX.')
    console.log('Public removeMember + Registry coordinator + MLS removal + idempotent retry + restart all PASS.')
    console.log('Live Workspace Messenger was not patched.')
    console.log('NEXT: integrate this proven contract into Workspace Account↔Device behind the real account/device owner.')
    console.log(`Report: ${REPORT_PATH}`)
    console.log('')
  } catch (error) {
    report.finishedAt = now()
    report.summary = {
      result: 'FAIL',
      error: compactError(error),
      liveWorkspaceModified: false,
    }
    try { writePrivateJson(REPORT_PATH, report) } catch {}
    console.error('')
    console.error('DEVICE LAB L4 FAILED:', error?.stack || error)
    console.error(`Report: ${REPORT_PATH}`)
    process.exitCode = 1
  } finally {
    await closeClients(clients)
  }
}

main()
