import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const RUNTIME_DIR = path.join(PROJECT_ROOT, 'src', 'messenger', 'native-runtime')
const CLIENT_PATH = path.join(RUNTIME_DIR, 'secure-local-service-client.mjs')
const BINARY_SUFFIX = process.platform === 'win32' ? '.exe' : ''
const BINARY_PATH = path.join(
  RUNTIME_DIR,
  `irgeztne-green-lightning-secure-local-service-v04n${BINARY_SUFFIX}`
)

const LAB_ROOT = path.join(
  os.homedir(),
  'Загрузки',
  '_IRGEZTNE_LABS',
  'messenger-device-lab-v02'
)
const DATA_ROOT = path.join(LAB_ROOT, 'data')
const REGISTRY_PATH = path.join(LAB_ROOT, 'device-registry.json')
const REPORT_PATH = path.join(LAB_ROOT, 'last-report.json')
const CONTEXT_DIR = path.join(LAB_ROOT, 'native-remove-context')
const CONVERSATION_ID = 'device-lab-group-v02'
const KEYRING_PREFIX = 'com.irgeztne.green-lightning.sandbox.device-lab.v02'

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
function line(label, value = '') {
  console.log(value === '' ? label : `${label} ${value}`)
}
function compactError(error) {
  return {
    name: String(error?.name || 'Error'),
    code: String(error?.code || ''),
    message: String(error?.message || error || ''),
  }
}
function unknownOperation(error) {
  const text = `${error?.code || ''} ${error?.message || ''}`.toLowerCase()
  return (
    text.includes('unknown op') ||
    text.includes('unknown operation') ||
    text.includes('unsupported op') ||
    text.includes('unsupported operation') ||
    text.includes('invalid operation') ||
    text.includes('no such operation') ||
    text.includes('unrecognized')
  )
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
      schema: 'irgeztne-messenger-device-registry-lab-v2',
      version: 2,
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

function recorder() {
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

async function openClients(SecureLocalServiceClient) {
  const map = new Map()
  for (const def of DEFINITIONS) {
    const client = new SecureLocalServiceClient({
      dataDir: path.join(DATA_ROOT, def.slot),
      identity: def.identity,
      keyringService: def.keyringService,
      binaryPath: BINARY_PATH,
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

async function resetLab(deleteRootKey) {
  ensureDir(LAB_ROOT)
  for (const def of DEFINITIONS) {
    try {
      deleteRootKey({
        keyringService: def.keyringService,
        binaryPath: BINARY_PATH,
      })
    } catch {}
  }
  for (const target of [DATA_ROOT, REGISTRY_PATH, REPORT_PATH, CONTEXT_DIR]) {
    try { fs.rmSync(target, { recursive: true, force: true }) } catch {}
  }
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
  if (!addB1?.welcome_hex || !addB1?.commit_hex) {
    throw new Error('B1 add_member missing welcome_hex/commit_hex')
  }
  await a2.applyCommit(CONVERSATION_ID, addB1.commit_hex)
  await b1.joinGroup(CONVERSATION_ID, addB1.welcome_hex)

  const kpC1 = await c1.keyPackage()
  const addC1 = await a1.addMember(CONVERSATION_ID, kpC1.key_package_hex)
  if (!addC1?.welcome_hex || !addC1?.commit_hex) {
    throw new Error('C1 add_member missing welcome_hex/commit_hex')
  }
  await Promise.all([
    a2.applyCommit(CONVERSATION_ID, addC1.commit_hex),
    b1.applyCommit(CONVERSATION_ID, addC1.commit_hex),
  ])
  await c1.joinGroup(CONVERSATION_ID, addC1.welcome_hex)
}

async function statuses(clients, deviceIds = DEFINITIONS.map((d) => d.deviceId)) {
  const out = {}
  for (const deviceId of deviceIds) {
    out[deviceId] = await clients.get(deviceId).groupStatus(CONVERSATION_ID)
  }
  return out
}

function groupIds(statusMap) {
  return new Set(
    Object.values(statusMap)
      .map((s) => String(s?.group_id_hex || ''))
      .filter(Boolean)
  )
}

async function gatedSend({ registry, clients, senderDeviceId, recipients, plaintext }) {
  registry.assertActive(senderDeviceId)
  const encrypted = await clients.get(senderDeviceId).encrypt(CONVERSATION_ID, plaintext)
  if (!encrypted?.message_hex) throw new Error('encrypt returned no message_hex')
  const received = []
  for (const recipientId of recipients) {
    const decrypted = await clients.get(recipientId).decrypt(CONVERSATION_ID, encrypted.message_hex)
    if (!decrypted || decrypted.plaintext !== plaintext) {
      throw new Error(`decrypt mismatch at ${recipientId}`)
    }
    received.push(recipientId)
  }
  return { ciphertext: encrypted.message_hex, received }
}

function collectStringEvidence() {
  try {
    const output = execFileSync('strings', [BINARY_PATH], {
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    })
    return output
      .split(/\r?\n/)
      .filter((line) => /remove[_ -]?member|leaf[_ -]?index|member[_ -]?index|add[_ -]?member|apply[_ -]?commit/i.test(line))
      .slice(0, 250)
  } catch (error) {
    return [`strings unavailable or failed: ${String(error?.message || error)}`]
  }
}

function findNumericCandidates(value, pathParts = [], out = []) {
  if (Array.isArray(value)) {
    value.forEach((item, i) => findNumericCandidates(item, [...pathParts, String(i)], out))
    return out
  }
  if (!value || typeof value !== 'object') return out

  for (const [key, item] of Object.entries(value)) {
    const nextPath = [...pathParts, key]
    if (
      typeof item === 'number' &&
      /(leaf|member|index|position)/i.test(key)
    ) {
      out.push({ path: nextPath.join('.'), value: item })
    }
    findNumericCandidates(item, nextPath, out)
  }
  return out
}

async function rawRemoveProbe(a1, initialStatus, attempts) {
  // First ask with conversation_id only. If the operation is unknown, stop:
  // do not guess field names against an unsupported native contract.
  try {
    const result = await a1.request('remove_member', {
      conversation_id: CONVERSATION_ID,
    })
    attempts.push({
      shape: 'conversation_id only',
      status: 'OK',
      result,
    })
    return { supported: true, result, shape: 'conversation_id only' }
  } catch (error) {
    attempts.push({
      shape: 'conversation_id only',
      status: 'ERROR',
      error: compactError(error),
    })
    if (unknownOperation(error)) {
      return { supported: false, error }
    }
  }

  const a2 = DEFINITIONS.find((d) => d.deviceId === 'device-a2')
  const numeric = findNumericCandidates(initialStatus)
  const candidateIndices = [...new Set([
    ...numeric.map((item) => item.value),
    1, // A2 was the first member added after creator in this isolated sandbox.
  ])].filter((value) => Number.isInteger(value) && value >= 0 && value <= 64)

  const shapes = [
    ['member_identity', a2.identity],
    ['identity', a2.identity],
    ['device_id', a2.deviceId],
    ['member_device_id', a2.deviceId],
    ...candidateIndices.map((value) => ['leaf_index', value]),
    ...candidateIndices.map((value) => ['member_index', value]),
  ]

  const seen = new Set()
  for (const [field, value] of shapes) {
    const key = `${field}:${String(value)}`
    if (seen.has(key)) continue
    seen.add(key)

    try {
      const result = await a1.request('remove_member', {
        conversation_id: CONVERSATION_ID,
        [field]: value,
      })
      attempts.push({
        shape: `${field}=${JSON.stringify(value)}`,
        status: 'OK',
        result,
      })
      return {
        supported: true,
        result,
        shape: `${field}=${JSON.stringify(value)}`,
      }
    } catch (error) {
      attempts.push({
        shape: `${field}=${JSON.stringify(value)}`,
        status: 'ERROR',
        error: compactError(error),
      })
      if (unknownOperation(error)) {
        return { supported: false, error }
      }
    }
  }

  return {
    supported: true,
    result: null,
    shape: null,
    error: new Error('remove_member appears recognized, but no tested selector shape succeeded'),
  }
}

function findNativeSourceCandidates() {
  const roots = [
    PROJECT_ROOT,
    path.dirname(PROJECT_ROOT),
  ]
  const seen = new Set()
  const files = []

  function walk(dir, depth) {
    if (depth < 0) return
    let entries
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }

    for (const entry of entries) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.git' ||
        entry.name === 'target' ||
        entry.name === 'dist' ||
        entry.name === 'build' ||
        entry.name === '_CHECKPOINTS' ||
        entry.name === '_IRGEZTNE_LABS'
      ) continue

      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full, depth - 1)
        continue
      }

      if (!entry.isFile()) continue
      if (!/\.(rs|toml)$/.test(entry.name) && entry.name !== 'Cargo.lock' && entry.name !== 'build.rs') continue

      let stat
      try { stat = fs.statSync(full) } catch { continue }
      if (stat.size > 2 * 1024 * 1024) continue

      let text = ''
      try { text = fs.readFileSync(full, 'utf8') } catch { continue }

      const relevant = (
        entry.name === 'Cargo.toml' ||
        entry.name === 'Cargo.lock' ||
        /secure-local-service|green-lightning|openmls|add_member|apply_commit|join_group|group_status|remove_member/i.test(text)
      )
      if (!relevant) continue

      const canonical = path.resolve(full)
      if (seen.has(canonical)) continue
      seen.add(canonical)
      files.push(canonical)
    }
  }

  for (const root of roots) walk(root, 7)
  return files
}

function writeNativeContextBundle(report) {
  const candidates = findNativeSourceCandidates()
  if (!candidates.length) return null

  fs.rmSync(CONTEXT_DIR, { recursive: true, force: true })
  ensureDir(CONTEXT_DIR)

  const manifest = []
  candidates.forEach((source, index) => {
    const safeName = `${String(index + 1).padStart(3, '0')}-${path.basename(source)}`
    const target = path.join(CONTEXT_DIR, safeName)
    fs.copyFileSync(source, target)
    manifest.push({
      copiedAs: safeName,
      originalPath: source,
      size: fs.statSync(source).size,
    })
  })

  writePrivateJson(path.join(CONTEXT_DIR, 'manifest.json'), {
    schema: 'irgeztne-mls-remove-native-context-v1',
    createdAt: now(),
    projectRoot: PROJECT_ROOT,
    reportSummary: report.summary || null,
    files: manifest,
  })

  const zipName = `IRGEZTNE-MLS-REMOVE-CONTEXT-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.zip`
  const zipPath = path.join(os.homedir(), 'Загрузки', zipName)

  try {
    execFileSync('zip', ['-qr', zipPath, '.'], {
      cwd: CONTEXT_DIR,
      stdio: 'ignore',
    })
    return zipPath
  } catch {
    return null
  }
}

async function main() {
  if (!fs.existsSync(CLIENT_PATH)) {
    throw new Error(`Secure local service client missing: ${CLIENT_PATH}`)
  }
  if (!fs.existsSync(BINARY_PATH)) {
    throw new Error(`Live native binary missing: ${BINARY_PATH}`)
  }

  const module = await import(pathToFileURL(CLIENT_PATH).href)
  const { SecureLocalServiceClient, deleteRootKey } = module
  if (typeof SecureLocalServiceClient !== 'function') {
    throw new Error('SecureLocalServiceClient unavailable')
  }
  if (typeof deleteRootKey !== 'function') {
    throw new Error('deleteRootKey unavailable')
  }

  const T = recorder()
  const report = {
    schema: 'irgeztne-messenger-device-lab-l2-report-v1',
    startedAt: now(),
    projectRoot: PROJECT_ROOT,
    labRoot: LAB_ROOT,
    binaryPath: BINARY_PATH,
    conversationId: CONVERSATION_ID,
    tests: T.list,
    binaryStringEvidence: collectStringEvidence(),
    removeMemberAttempts: [],
  }

  let clients = null
  const registry = new DeviceRegistry(REGISTRY_PATH)

  line('')
  line('IRGEZTNE Messenger Device Lab v0.2L2')
  line('Sandbox:', LAB_ROOT)
  line('Main Workspace Chat/data are NOT used or modified.')
  line('')

  try {
    await resetLab(deleteRootKey)
    T.pass('isolated_l2_reset', 'new v02 data + new v02 keyring namespace')

    registry.createFresh()
    T.pass('device_registry_create', '3 accounts / 4 devices')

    clients = await openClients(SecureLocalServiceClient)
    T.pass('native_clients_start', 'A1, A2, Mirror, Camel')

    await buildFourMemberGroup(clients)
    const before = await statuses(clients)
    report.groupStatusBeforeRemove = before

    const ids = groupIds(before)
    if (ids.size !== 1) throw new Error('4-member group id mismatch before remove probe')
    const originalGroupId = [...ids][0]
    T.pass('mls_group_bootstrap_4', `group=${originalGroupId.slice(0, 24)}…`)

    const baseline = await gatedSend({
      registry,
      clients,
      senderDeviceId: 'device-a1',
      recipients: ['device-a2', 'device-b1', 'device-c1'],
      plaintext: `L2 baseline ${crypto.randomUUID()}`,
    })
    if (baseline.received.length !== 3) throw new Error('baseline did not reach all devices')
    T.pass('baseline_group_traffic', 'A1 -> A2 + Mirror + Camel')

    registry.revoke('device-a2')
    T.pass('registry_revoke_a2', 'application gate revoked A2')

    const a1 = clients.get('device-a1')
    const probe = await rawRemoveProbe(
      a1,
      before['device-a1'],
      report.removeMemberAttempts
    )
    report.removeMemberProbe = {
      supported: probe.supported,
      shape: probe.shape || null,
      error: probe.error ? compactError(probe.error) : null,
      result: probe.result || null,
    }

    if (!probe.supported) {
      T.gap(
        'native_remove_member_operation',
        'current binary reports remove_member as unsupported/unrecognized'
      )

      report.finishedAt = now()
      report.summary = {
        pass: T.list.filter((t) => t.status === 'PASS').length,
        fail: T.list.filter((t) => t.status === 'FAIL').length,
        knownGap: T.list.filter((t) => t.status === 'KNOWN_GAP').length,
        removeMemberNativeOperation: 'ABSENT_OR_UNRECOGNIZED',
      }
      writePrivateJson(REPORT_PATH, report)

      const contextZip = writeNativeContextBundle(report)
      report.nativeSourceContextZip = contextZip
      writePrivateJson(REPORT_PATH, report)

      line('')
      line('RESULT: Registry revoke remains proven; native remove_member is not available in this binary contract.')
      if (contextZip) {
        line('NATIVE SOURCE CONTEXT:', contextZip)
        line('Upload that ZIP here; it contains only relevant Rust/Cargo source candidates.')
      } else {
        line('NATIVE SOURCE CONTEXT: no relevant Rust/Cargo source was found automatically.')
      }
      line('Report:', REPORT_PATH)
      line('')
      return
    }

    if (!probe.result) {
      T.gap(
        'remove_member_selector_contract',
        'binary recognizes remove_member, but tested selector shapes did not succeed'
      )

      report.finishedAt = now()
      report.summary = {
        pass: T.list.filter((t) => t.status === 'PASS').length,
        fail: T.list.filter((t) => t.status === 'FAIL').length,
        knownGap: T.list.filter((t) => t.status === 'KNOWN_GAP').length,
        removeMemberNativeOperation: 'RECOGNIZED_SELECTOR_UNKNOWN',
      }
      writePrivateJson(REPORT_PATH, report)

      const contextZip = writeNativeContextBundle(report)
      report.nativeSourceContextZip = contextZip
      writePrivateJson(REPORT_PATH, report)

      line('')
      line('RESULT: remove_member exists, but its selector contract is not exposed by the JS client.')
      line('Successful selector: NONE')
      if (contextZip) line('NATIVE SOURCE CONTEXT:', contextZip)
      line('Report:', REPORT_PATH)
      line('')
      return
    }

    T.pass('native_remove_member_call', `selector ${probe.shape}`)

    const commitHex = String(
      probe.result?.commit_hex ||
      probe.result?.commit ||
      ''
    )
    if (!commitHex) {
      T.gap(
        'remove_member_commit_contract',
        'remove_member succeeded but returned no recognizable commit_hex'
      )
      report.finishedAt = now()
      report.summary = {
        pass: T.list.filter((t) => t.status === 'PASS').length,
        fail: T.list.filter((t) => t.status === 'FAIL').length,
        knownGap: T.list.filter((t) => t.status === 'KNOWN_GAP').length,
        removeMemberNativeOperation: 'CALL_SUCCEEDED_NO_COMMIT',
      }
      writePrivateJson(REPORT_PATH, report)
      const contextZip = writeNativeContextBundle(report)
      report.nativeSourceContextZip = contextZip
      writePrivateJson(REPORT_PATH, report)
      if (contextZip) line('NATIVE SOURCE CONTEXT:', contextZip)
      line('Report:', REPORT_PATH)
      return
    }

    await Promise.all([
      clients.get('device-b1').applyCommit(CONVERSATION_ID, commitHex),
      clients.get('device-c1').applyCommit(CONVERSATION_ID, commitHex),
    ])
    T.pass('remaining_members_apply_remove_commit', 'Mirror + Camel applied removal commit')

    const after = await statuses(clients, ['device-a1', 'device-b1', 'device-c1'])
    report.groupStatusAfterRemove = after
    const afterIds = groupIds(after)
    if (afterIds.size !== 1) throw new Error('remaining members disagree after remove commit')
    T.pass('remaining_group_converges', 'A1 + Mirror + Camel share the post-remove group')

    const encrypted = await clients.get('device-a1').encrypt(
      CONVERSATION_ID,
      `after cryptographic revoke ${crypto.randomUUID()}`
    )
    if (!encrypted?.message_hex) throw new Error('post-remove encrypt returned no message_hex')

    for (const recipientId of ['device-b1', 'device-c1']) {
      const dec = await clients.get(recipientId).decrypt(CONVERSATION_ID, encrypted.message_hex)
      if (!dec?.plaintext) throw new Error(`${recipientId} could not decrypt post-remove traffic`)
    }
    T.pass('remaining_members_decrypt_after_remove', 'Mirror + Camel decrypt new epoch traffic')

    let a2BlockedCryptographically = false
    let a2Error = null
    try {
      const dec = await clients.get('device-a2').decrypt(CONVERSATION_ID, encrypted.message_hex)
      a2BlockedCryptographically = !dec?.plaintext
    } catch (error) {
      a2BlockedCryptographically = true
      a2Error = compactError(error)
    }
    report.revokedA2PostRemoveDecrypt = {
      blocked: a2BlockedCryptographically,
      error: a2Error,
    }

    if (!a2BlockedCryptographically) {
      throw new Error('A2 STILL decrypted new traffic after remove_member')
    }
    T.pass('revoked_device_crypto_denied', 'A2 cannot decrypt post-remove traffic')

    await closeClients(clients)
    clients = null
    T.pass('services_close_for_restart')

    const registry2 = new DeviceRegistry(REGISTRY_PATH)
    registry2.load()
    if (registry2.getDevice('device-a2')?.status !== 'revoked') {
      throw new Error('registry revoke did not survive restart')
    }
    T.pass('registry_restart_persistence')

    clients = await openClients(SecureLocalServiceClient)
    const restartStatus = await statuses(clients, ['device-a1', 'device-b1', 'device-c1'])
    const restartIds = groupIds(restartStatus)
    if (restartIds.size !== 1) throw new Error('remaining MLS members disagree after restart')
    T.pass('post_remove_mls_restart_persistence', 'A1 + Mirror + Camel reopened same post-remove group')

    const encrypted2 = await clients.get('device-a1').encrypt(
      CONVERSATION_ID,
      `restart post remove ${crypto.randomUUID()}`
    )
    for (const recipientId of ['device-b1', 'device-c1']) {
      const dec = await clients.get(recipientId).decrypt(CONVERSATION_ID, encrypted2.message_hex)
      if (!dec?.plaintext) throw new Error(`${recipientId} failed post-restart decrypt`)
    }
    T.pass('remaining_group_works_after_restart')

    let a2StillBlocked = false
    try {
      const dec = await clients.get('device-a2').decrypt(CONVERSATION_ID, encrypted2.message_hex)
      a2StillBlocked = !dec?.plaintext
    } catch {
      a2StillBlocked = true
    }
    if (!a2StillBlocked) throw new Error('A2 regained decrypt ability after restart')
    T.pass('revoked_device_stays_crypto_denied_after_restart')

    report.finishedAt = now()
    report.summary = {
      pass: T.list.filter((t) => t.status === 'PASS').length,
      fail: T.list.filter((t) => t.status === 'FAIL').length,
      knownGap: T.list.filter((t) => t.status === 'KNOWN_GAP').length,
      removeMemberNativeOperation: 'PROVEN',
      successfulSelector: probe.shape,
      revokedA2CryptoDenied: true,
    }
    writePrivateJson(REPORT_PATH, report)

    line('')
    line('RESULT: TRUE MLS MEMBER REMOVAL IS PROVEN IN THE SANDBOX.')
    line('A2 is revoked by registry AND cannot decrypt the new MLS epoch.')
    line('NEXT: expose the proven native remove-member contract cleanly in SecureLocalServiceClient, still in the lab, then integrate Account↔Device into Workspace.')
    line('Report:', REPORT_PATH)
    line('')
  } catch (error) {
    T.fail('lab_run', error)
    report.finishedAt = now()
    report.summary = {
      pass: T.list.filter((t) => t.status === 'PASS').length,
      fail: T.list.filter((t) => t.status === 'FAIL').length,
      knownGap: T.list.filter((t) => t.status === 'KNOWN_GAP').length,
    }
    try { writePrivateJson(REPORT_PATH, report) } catch {}
    throw error
  } finally {
    await closeClients(clients)
  }
}

main().catch((error) => {
  console.error('')
  console.error('DEVICE LAB L2 FAILED:', error?.stack || error)
  process.exitCode = 1
})
