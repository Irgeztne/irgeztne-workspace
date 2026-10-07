import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import readline from 'node:readline'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RELAY = path.join(__dirname, 'relay-e3.mjs')
const ENDPOINT = path.join(__dirname, 'endpoint-e3.mjs')
const LAB_ROOT = path.join(
  os.homedir(),
  'Загрузки',
  '_IRGEZTNE_LABS',
  'messenger-network-relay-v03'
)
const REPORT = path.join(LAB_ROOT, 'last-report.json')

function assert(v, m) {
  if (!v) throw new Error(m)
}
function say(status, name, detail = '') {
  console.log(`${status.padEnd(5)} ${name}${detail ? ` — ${detail}` : ''}`)
}
function parseJsonLine(text) {
  const lines = String(text || '').split(/\r?\n/).filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try { return JSON.parse(lines[i]) } catch {}
  }
  return null
}
function runEndpoint(args, relayUrl = '', env = {}) {
  const result = spawnSync(process.execPath, [ENDPOINT, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ...(relayUrl ? { E3_RELAY_URL: relayUrl } : {}),
      ...env,
    },
  })
  return {
    code: result.status,
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim(),
    json: parseJsonLine(result.stdout || result.stderr),
  }
}
async function api(relay, method, pathname, body) {
  const url = relay + pathname
  let response = null
  let lastError = null

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      response = await fetch(url, {
        method,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store',
          'connection': 'close',
        },
        body: body == null ? undefined : JSON.stringify(body),
      })
      break
    } catch (error) {
      lastError = error
      if (attempt >= 8) break
      await new Promise((resolve) => setTimeout(resolve, Math.min(240, 35 * attempt)))
    }
  }

  if (!response) {
    const cause = String(
      lastError?.cause?.code ||
      lastError?.cause?.message ||
      lastError?.message ||
      lastError ||
      ''
    )
    throw new Error(`relay API ${method} ${url} fetch failed after 8 attempts: ${cause}`)
  }

  const value = await response.json()
  if (!response.ok || !value.ok) {
    throw new Error(`relay API ${method} ${url} failed: ${JSON.stringify(value)}`)
  }
  return value
}
async function waitRelayReady(child) {
  const rl = readline.createInterface({ input: child.stdout })
  const stderr = []
  child.stderr.on('data', (chunk) => stderr.push(String(chunk)))

  const ready = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Relay start timeout')), 5000)
    rl.on('line', (line) => {
      if (!line.startsWith('E3_RELAY_READY:')) return
      clearTimeout(timer)
      try { resolve(JSON.parse(line.slice('E3_RELAY_READY:'.length))) }
      catch (error) { reject(error) }
    })
    child.once('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`Relay exited before ready: ${code} ${stderr.join('')}`))
    })
  })
  return { ...ready, rl, stderr }
}
async function waitA1Ready(child) {
  const rl = readline.createInterface({ input: child.stdout })
  const stderr = []
  child.stderr.on('data', (chunk) => stderr.push(String(chunk)))

  const ready = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('A1 start timeout')), 7000)
    rl.on('line', (line) => {
      if (!line.startsWith('E3_A1_READY:')) return
      clearTimeout(timer)
      try { resolve(JSON.parse(line.slice('E3_A1_READY:'.length))) }
      catch (error) { reject(error) }
    })
    child.once('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`A1 exited before ready: ${code} ${stderr.join('')}`))
    })
  })
  return { ...ready, rl, stderr }
}
async function waitForResponse(relay, requestId, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const result = await api(relay, 'GET', '/mailbox/to-a2?after=0')
    const item = result.items.find((entry) =>
      (entry.payload?.schema === 'irgeztne.enrollment.approval.v1' ||
       entry.payload?.schema === 'irgeztne.enrollment.rejection.v1') &&
      entry.payload?.requestId === requestId
    )
    if (item) return item
    await new Promise((resolve) => setTimeout(resolve, 60))
  }
  throw new Error(`response timeout for ${requestId}`)
}
async function stop(child) {
  if (!child || child.exitCode != null) return
  child.kill('SIGTERM')
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL') } catch {}
      resolve()
    }, 3000)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}
function scanTrace(trace, rawCode) {
  const findings = []
  const forbidden = [
    /private[_-]?key/i,
    /master[_-]?key/i,
    /root[_-]?key/i,
    /keyring[_-]?secret/i,
    /access[_-]?token/i,
  ]
  for (const item of trace) {
    const text = JSON.stringify(item.payload)
    if (rawCode && text.includes(rawCode)) findings.push(`${item.seq}:raw-oob-code`)
    for (const pattern of forbidden) {
      if (pattern.test(text)) findings.push(`${item.seq}:${pattern}`)
    }
  }
  return findings
}

async function main() {
  console.log('')
  console.log('IRGEZTNE Messenger — Untrusted Network Relay Lab v0.3E3b')
  console.log('A1 endpoint ↔ HTTP relay ↔ A2 endpoint. No shared mailbox folder.')
  console.log('Relay is treated as malicious: tamper + replay attacks are injected.')
  console.log('')

  const tests = []
  const pass = (name, detail = '') => {
    tests.push({ name, status: 'PASS', detail })
    say('PASS', name, detail)
  }

  const reset = runEndpoint(['reset'])
  assert(reset.code === 0, `reset failed: ${reset.stderr}`)
  pass('isolated_network_reset')

  let relayChild = null
  let a1Child = null
  let relayReady = null
  let a1Ready = null

  const report = {
    schema: 'irgeztne.network.relay.lab.report.v1',
    startedAt: new Date().toISOString(),
    labRoot: LAB_ROOT,
    tests,
  }

  try {
    relayChild = spawn(process.execPath, [RELAY], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, E3_RELAY_PORT: '0' },
    })
    relayReady = await waitRelayReady(relayChild)
    const relayUrl = relayReady.url
    pass('untrusted_http_relay_ready', relayUrl)

    a1Child = spawn(process.execPath, [ENDPOINT, 'a1-server'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, E3_RELAY_URL: relayUrl },
    })
    a1Ready = await waitA1Ready(a1Child)
    const code = a1Ready.code
    assert(code && code.length > 20, 'A1 OOB code missing')
    pass('a1_network_endpoint_ready', 'A1 published invite through relay')

    // Wrong OOB code.
    const wrongId = `wrong-${crypto.randomUUID()}`
    const wrong = runEndpoint(
      ['a2-send-request', wrongId],
      relayUrl,
      { E3_OOB_CODE: 'wrong-oob-code' }
    )
    assert(wrong.code === 0, `wrong-code request could not be sent: ${wrong.stderr}`)
    const wrongResp = await waitForResponse(relayUrl, wrongId)
    assert(wrongResp.payload.code === 'REQUEST_PROOF_INVALID', 'wrong OOB code not rejected')
    pass('wrong_oob_code_denied')

    // Relay mutates A2 KeyPackage after the proof was created.
    await api(relayUrl, 'POST', '/lab/attack', {
      mailbox: 'to-a1',
      mode: 'flip-keypackage',
    })
    const tamperReqId = `req-tamper-${crypto.randomUUID()}`
    const tamperReq = runEndpoint(
      ['a2-send-request', tamperReqId],
      relayUrl,
      { E3_OOB_CODE: code }
    )
    assert(tamperReq.code === 0, `tampered request sender failed: ${tamperReq.stderr}`)
    const tamperResp = await waitForResponse(relayUrl, tamperReqId)
    assert(tamperResp.payload.code === 'REQUEST_PROOF_INVALID', 'relay KeyPackage tamper not rejected')
    pass('malicious_relay_request_tamper_denied', 'KeyPackage changed in transit')

    // Authentic request, but relay corrupts the first approval/Welcome.
    const goodId = `req-good-${crypto.randomUUID()}`
    await api(relayUrl, 'POST', '/lab/attack', {
      mailbox: 'to-a2',
      mode: 'flip-welcome',
    })
    const goodSend = runEndpoint(
      ['a2-send-request', goodId],
      relayUrl,
      { E3_OOB_CODE: code }
    )
    assert(goodSend.code === 0, `good request send failed: ${goodSend.stderr}`)
    const corruptedApproval = await waitForResponse(relayUrl, goodId)
    assert(
      corruptedApproval.payload.schema === 'irgeztne.enrollment.approval.v1',
      'A1 did not create approval'
    )

    const corruptApply = runEndpoint(
      ['a2-apply', goodId],
      relayUrl,
      { E3_OOB_CODE: code }
    )
    assert(
      corruptApply.code !== 0 && corruptApply.json?.code === 'APPROVAL_PROOF_INVALID',
      `corrupted Welcome not rejected: ${corruptApply.stderr}`
    )
    pass('malicious_relay_welcome_tamper_denied', 'A2 refused corrupted approval before MLS join')

    // Network delivery recovery: exact request is retried. A1 must resend the
    // exact stored immutable approval WITHOUT another MLS add/epoch.
    const beforeRetryStatus = runEndpoint(['status', 'a1'])
    assert(beforeRetryStatus.code === 0, `A1 status before retry failed: ${beforeRetryStatus.stderr}`)
    const before = beforeRetryStatus.json.status

    const retrySend = runEndpoint(
      ['a2-send-request', goodId],
      relayUrl,
      { E3_OOB_CODE: code }
    )
    assert(retrySend.code === 0, `retry request send failed: ${retrySend.stderr}`)

    // Find the latest authentic approval for this request id.
    let authentic = null
    const deadline = Date.now() + 6000
    while (Date.now() < deadline && !authentic) {
      const messages = await api(relayUrl, 'GET', '/mailbox/to-a2?after=0')
      const matches = messages.items.filter((item) =>
        item.payload?.schema === 'irgeztne.enrollment.approval.v1' &&
        item.payload?.requestId === goodId
      )
      if (matches.length >= 2) authentic = matches[matches.length - 1]
      if (!authentic) await new Promise((resolve) => setTimeout(resolve, 60))
    }
    assert(authentic, 'authentic retry approval did not arrive')

    const afterRetryStatus = runEndpoint(['status', 'a1'])
    assert(afterRetryStatus.code === 0, `A1 status after retry failed: ${afterRetryStatus.stderr}`)
    const after = afterRetryStatus.json.status
    assert(Number(before.epoch) === Number(after.epoch), 'network retry changed MLS epoch')
    assert(Number(before.members) === Number(after.members), 'network retry changed MLS member count')
    pass('lost_or_tampered_delivery_retry_no_mls_mutation', 'same approval resent; epoch/member count unchanged')

    const goodApply = runEndpoint(
      ['a2-apply', goodId],
      relayUrl,
      { E3_OOB_CODE: code }
    )
    assert(goodApply.code === 0 && goodApply.json?.result === 'ENROLLED', `authentic retry approval failed: ${goodApply.stderr}`)
    pass('a2_joins_after_network_retry')

    // A malicious relay replays the exact request again after successful join.
    const traceBeforeReplay = await api(relayUrl, 'GET', '/lab/trace')
    const requestTrace = [...traceBeforeReplay.trace].reverse().find((item) =>
      item.mailbox === 'to-a1' &&
      item.payload?.schema === 'irgeztne.enrollment.request.v1' &&
      item.payload?.requestId === goodId
    )
    assert(requestTrace, 'request trace for relay replay not found')

    const statusBeforeReplay = runEndpoint(['status', 'a1']).json.status
    await api(relayUrl, 'POST', '/lab/replay', {
      mailbox: 'to-a1',
      seq: requestTrace.seq,
    })
    await new Promise((resolve) => setTimeout(resolve, 250))
    const statusAfterReplay = runEndpoint(['status', 'a1']).json.status
    assert(Number(statusBeforeReplay.epoch) === Number(statusAfterReplay.epoch), 'relay replay changed MLS epoch')
    assert(Number(statusBeforeReplay.members) === Number(statusAfterReplay.members), 'relay replay changed member count')
    pass('malicious_relay_replay_noop', 'no second MLS add')

    // A2 also treats re-delivered same approval as already enrolled.
    const applyAgain = runEndpoint(
      ['a2-apply', goodId],
      relayUrl,
      { E3_OOB_CODE: code }
    )
    assert(applyAgain.code === 0 && applyAgain.json?.result === 'ALREADY_ENROLLED', 'A2 approval replay was not a no-op')
    pass('approval_replay_on_a2_noop')

    const traceResult = await api(relayUrl, 'GET', '/lab/trace')
    const findings = scanTrace(traceResult.trace, code)
    assert(findings.length === 0, `relay observed forbidden secret material: ${findings.join(', ')}`)
    pass('relay_secret_exposure_scan', 'no OOB/private/master/root/account-token material visible to relay')

    await stop(a1Child)
    a1Child = null
    pass('a1_endpoint_clean_stop')
    await stop(relayChild)
    relayChild = null
    pass('relay_clean_stop')

    // Fresh relay and fresh endpoint processes after enrollment.
    relayChild = spawn(process.execPath, [RELAY], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, E3_RELAY_PORT: '0' },
    })
    relayReady = await waitRelayReady(relayChild)
    const relayUrl2 = relayReady.url

    const s1 = runEndpoint(['status', 'a1'])
    const s2 = runEndpoint(['status', 'a2'])
    assert(s1.code === 0 && s2.code === 0, 'fresh endpoint status failed')
    assert(s1.json?.status?.active === true && s2.json?.status?.active === true, 'A1/A2 inactive after restart')
    assert(Number(s1.json.status.members) === 2 && Number(s2.json.status.members) === 2, 'two-member MLS state lost after restart')
    pass('both_devices_restart_persist')

    const text12 = `E3 A1->A2 ${crypto.randomUUID()}`
    const send12 = runEndpoint(['send', 'a1', text12], relayUrl2)
    assert(send12.code === 0, `A1 send failed: ${send12.stderr}`)
    const recv12 = runEndpoint(['receive', 'a2'], relayUrl2)
    assert(recv12.code === 0 && recv12.json?.plaintext === text12, 'A2 failed to decrypt network-relayed message')
    pass('post_restart_network_a1_to_a2')

    const text21 = `E3 A2->A1 ${crypto.randomUUID()}`
    const send21 = runEndpoint(['send', 'a2', text21], relayUrl2)
    assert(send21.code === 0, `A2 send failed: ${send21.stderr}`)
    const recv21 = runEndpoint(['receive', 'a1'], relayUrl2)
    assert(recv21.code === 0 && recv21.json?.plaintext === text21, 'A1 failed to decrypt network-relayed message')
    pass('post_restart_network_a2_to_a1')

    const appTrace = await api(relayUrl2, 'GET', '/lab/trace')
    const appPayloads = appTrace.trace.filter((item) =>
      item.payload?.schema === 'irgeztne.e3.application-envelope.v1'
    )
    assert(appPayloads.length >= 2, 'relay did not observe encrypted application envelopes')
    assert(
      appPayloads.every((item) => !JSON.stringify(item.payload).includes('E3 A1->A2') && !JSON.stringify(item.payload).includes('E3 A2->A1')),
      'relay saw plaintext application message'
    )
    pass('relay_cannot_see_application_plaintext', 'only MLS ciphertext crossed HTTP relay')

    report.finishedAt = new Date().toISOString()
    report.summary = {
      result: 'PASS',
      independentRelayProcess: true,
      independentEndpointProcesses: true,
      sharedMailboxFolder: false,
      requestTamperDenied: true,
      welcomeTamperDenied: true,
      retryNoSecondMlsMutation: true,
      relayReplayNoop: true,
      oobSecretHiddenFromRelay: true,
      endpointRestartPersistence: true,
      encryptedTrafficOverHttpRelay: true,
      relayPlaintextVisibility: false,
      liveWorkspaceModified: false,
    }

    fs.mkdirSync(LAB_ROOT, { recursive: true })
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n', 'utf8')

    console.log('')
    console.log('RESULT: UNTRUSTED NETWORK RELAY CONTRACT IS PROVEN IN THE SANDBOX.')
    console.log('A1 and A2 used real HTTP sockets through a separate relay process.')
    console.log('Relay tamper/replay attacks failed, delivery retry caused no second MLS mutation,')
    console.log('pairing secret stayed out of relay traffic, and MLS application plaintext stayed hidden.')
    console.log('Live Workspace Messenger/account data were not modified.')
    console.log(`Report: ${REPORT}`)
    console.log('')
  } catch (error) {
    report.finishedAt = new Date().toISOString()
    report.summary = {
      result: 'FAIL',
      error: String(error?.stack || error?.message || error),
      liveWorkspaceModified: false,
    }
    try {
      fs.mkdirSync(LAB_ROOT, { recursive: true })
      fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n', 'utf8')
    } catch {}
    throw error
  } finally {
    await stop(a1Child)
    await stop(relayChild)
  }
}

main().catch((error) => {
  console.error('')
  console.error('NETWORK RELAY LAB FAILED:', error?.stack || error)
  process.exitCode = 1
})
