import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import readline from 'node:readline'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const ENDPOINT = path.join(__dirname, 'endpoint-e2.mjs')
const LAB_ROOT = path.join(
  os.homedir(),
  'Загрузки',
  '_IRGEZTNE_LABS',
  'messenger-enrollment-transport-v02'
)
const A1_TO_A2 = path.join(LAB_ROOT, 'transport', 'a1-to-a2')
const A2_TO_A1 = path.join(LAB_ROOT, 'transport', 'a2-to-a1')
const PRIVATE_A1 = path.join(LAB_ROOT, 'private-a1')
const REPORT = path.join(LAB_ROOT, 'last-report.json')

function assert(v, m) {
  if (!v) throw new Error(m)
}
function say(status, name, detail = '') {
  console.log(`${status.padEnd(5)} ${name}${detail ? ` — ${detail}` : ''}`)
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}
function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8')
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
function run(args, env = {}) {
  const result = spawnSync(process.execPath, [ENDPOINT, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
  return {
    code: result.status,
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim(),
  }
}
function parseLastJson(text) {
  const lines = String(text || '').split(/\r?\n/).filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try { return JSON.parse(lines[i]) } catch {}
  }
  return null
}
async function waitFor(file, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (fs.existsSync(file)) return file
    await sleep(50)
  }
  throw new Error(`Timed out waiting for ${file}`)
}
function mutateHex(value) {
  const text = String(value || '')
  if (text.length < 2) return '00'
  const first = text[0].toLowerCase() === 'a' ? 'b' : 'a'
  return first + text.slice(1)
}
function copyJson(src, dst, mutate) {
  const value = readJson(src)
  const next = mutate ? mutate(JSON.parse(JSON.stringify(value))) : value
  writeJson(dst, next)
}
function scanTransportForForbidden(rawCode) {
  const forbiddenFields = [
    /private[_-]?key/i,
    /master[_-]?key/i,
    /root[_-]?key/i,
    /keyring[_-]?secret/i,
    /access[_-]?token/i,
  ]
  const findings = []

  for (const dir of [A1_TO_A2, A2_TO_A1]) {
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name)
      if (!fs.statSync(file).isFile()) continue
      const text = fs.readFileSync(file, 'utf8')
      if (rawCode && text.includes(rawCode)) {
        findings.push(`${name}:raw-oob-code`)
      }
      for (const pattern of forbiddenFields) {
        if (pattern.test(text)) findings.push(`${name}:${pattern}`)
      }
    }
  }
  return findings
}

async function startA1Server() {
  const child = spawn(process.execPath, [ENDPOINT, 'a1-server'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  })

  const rl = readline.createInterface({ input: child.stdout })
  const errLines = []
  child.stderr.on('data', (chunk) => errLines.push(String(chunk)))

  const ready = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('A1 server did not become ready')), 8000)

    rl.on('line', (line) => {
      if (!line.startsWith('E2_READY:')) return
      clearTimeout(timer)
      try {
        resolve(JSON.parse(line.slice('E2_READY:'.length)))
      } catch (error) {
        reject(error)
      }
    })

    child.on('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`A1 server exited before ready (${code}): ${errLines.join('')}`))
    })
  })

  return { child, ready, rl, errLines }
}

async function stopA1Server(server) {
  fs.writeFileSync(path.join(PRIVATE_A1, 'stop'), '1\n')
  const exit = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      try { server.child.kill('SIGTERM') } catch {}
      resolve({ forced: true })
    }, 5000)
    server.child.once('exit', (code) => {
      clearTimeout(timer)
      resolve({ forced: false, code })
    })
  })
  try { server.rl.close() } catch {}
  return exit
}

async function main() {
  const tests = []
  const pass = (name, detail = '') => {
    tests.push({ name, status: 'PASS', detail })
    say('PASS', name, detail)
  }

  console.log('')
  console.log('IRGEZTNE Messenger — Enrollment Transport Lab v0.2E2')
  console.log('Two independent Node endpoint processes; serialized file mailbox transport.')
  console.log('One-time code is operator/OOB only and must not appear in transport envelopes.')
  console.log('')

  const reset = run(['reset'])
  assert(reset.code === 0, `reset failed: ${reset.stderr}`)
  pass('isolated_transport_reset')

  let server = null
  let rawCode = ''
  const report = {
    schema: 'irgeztne.enrollment.transport.lab.report.v1',
    startedAt: new Date().toISOString(),
    labRoot: LAB_ROOT,
    tests,
  }

  try {
    server = await startA1Server()
    rawCode = server.ready.code
    assert(rawCode && rawCode.length > 20, 'A1 did not provide an OOB code')
    pass('a1_endpoint_process_ready', 'P21 secure core running in endpoint A1')

    const invite = server.ready.invitePath
    assert(fs.existsSync(invite), 'public invite not written to transport')
    const inviteObj = readJson(invite)
    assert(!JSON.stringify(inviteObj).includes(rawCode), 'raw OOB code leaked into public invite')
    pass('public_invite_serialized', 'no raw pairing secret in invite')

    // Wrong OOB code: request is well-formed but proof is invalid.
    const badReq = path.join(A2_TO_A1, 'request-wrong-code.json')
    const badMake = run(
      ['a2-make-request', invite, badReq],
      { E2_OOB_CODE: 'definitely-wrong-code' }
    )
    assert(badMake.code === 0, `A2 wrong-code request build failed: ${badMake.stderr}`)
    const badResp = path.join(A1_TO_A2, 'response-wrong-code.json')
    await waitFor(badResp)
    assert(readJson(badResp).code === 'REQUEST_PROOF_INVALID', 'wrong code was not rejected')
    pass('wrong_oob_code_denied', 'A1 rejected before MLS add')

    // Correctly proved request, then mutate public key package after proof.
    const originalTamperReq = path.join(A2_TO_A1, 'request-tamper-source.tmp')
    const makeTamper = run(
      ['a2-make-request', invite, originalTamperReq],
      { E2_OOB_CODE: rawCode }
    )
    assert(makeTamper.code === 0, `A2 tamper source build failed: ${makeTamper.stderr}`)
    const tamperedReq = path.join(A2_TO_A1, 'request-tampered.json')
    copyJson(originalTamperReq, tamperedReq, (value) => {
      value.keyPackageHex = mutateHex(value.keyPackageHex)
      return value
    })
    fs.rmSync(originalTamperReq, { force: true })

    const tamperedResp = path.join(A1_TO_A2, 'response-tampered.json')
    await waitFor(tamperedResp)
    assert(readJson(tamperedResp).code === 'REQUEST_PROOF_INVALID', 'tampered request was not rejected')
    pass('request_tamper_denied', 'KeyPackage mutation invalidated proof')

    // Real request.
    const goodReq = path.join(A2_TO_A1, 'request-good.json')
    const goodMake = run(
      ['a2-make-request', invite, goodReq],
      { E2_OOB_CODE: rawCode }
    )
    assert(goodMake.code === 0, `A2 good request failed: ${goodMake.stderr}`)
    const goodResp = path.join(A1_TO_A2, 'response-good.json')
    await waitFor(goodResp)
    const approval = readJson(goodResp)
    assert(approval.result === 'ENROLLED' && approval.welcomeHex, 'A1 did not approve A2')
    pass('serialized_request_approved', 'A1 produced signed Welcome envelope')

    // Tamper A1->A2 approval before A2 touches MLS.
    const tamperedApproval = path.join(A1_TO_A2, 'response-good-tampered.json')
    copyJson(goodResp, tamperedApproval, (value) => {
      value.welcomeHex = mutateHex(value.welcomeHex)
      return value
    })
    const tamperApply = run(
      ['a2-apply-approval', invite, goodReq, tamperedApproval],
      { E2_OOB_CODE: rawCode }
    )
    const tamperApplyJson = parseLastJson(tamperApply.stderr || tamperApply.stdout)
    assert(
      tamperApply.code !== 0 && tamperApplyJson?.code === 'APPROVAL_PROOF_INVALID',
      `tampered approval was not rejected: ${tamperApply.stderr}`
    )
    pass('approval_tamper_denied', 'A2 rejected mutated Welcome before join')

    // Apply the authentic approval.
    const goodApply = run(
      ['a2-apply-approval', invite, goodReq, goodResp],
      { E2_OOB_CODE: rawCode }
    )
    assert(goodApply.code === 0, `A2 authentic approval failed: ${goodApply.stderr}`)
    pass('a2_joins_from_serialized_welcome')

    // Exact replay: same serialized request, copied under another mailbox name.
    const replayReq = path.join(A2_TO_A1, 'request-replay.json')
    fs.copyFileSync(goodReq, replayReq)
    const replayResp = path.join(A1_TO_A2, 'response-replay.json')
    await waitFor(replayResp)
    const replayObj = readJson(replayResp)
    assert(replayObj.result === 'ALREADY_ENROLLED', 'exact replay not treated as no-op')
    assert(replayObj.welcomeHex === null && replayObj.commitHex === null, 'replay emitted new MLS artifacts')
    pass('exact_transport_replay_noop', 'ALREADY_ENROLLED; no new Welcome/Commit')

    const findings = scanTransportForForbidden(rawCode)
    assert(findings.length === 0, `forbidden secret material found in transport: ${findings.join(', ')}`)
    pass('transport_secret_scan', 'no OOB code/master/private/account-token material in envelopes')

    const stop = await stopA1Server(server)
    server = null
    pass('a1_endpoint_stops_cleanly', stop.forced ? 'forced stop fallback' : 'clean stop')

    // Full endpoint restart: each operation is now a fresh process.
    const s1 = run(['status', 'a1'])
    const s2 = run(['status', 'a2'])
    const s1j = parseLastJson(s1.stdout)
    const s2j = parseLastJson(s2.stdout)
    assert(s1.code === 0 && s2.code === 0, 'endpoint status restart failed')
    assert(s1j?.status?.active === true && s2j?.status?.active === true, 'endpoints not active after restart')
    assert(Number(s1j?.status?.members) === 2 && Number(s2j?.status?.members) === 2, 'two-member MLS group lost')
    pass('both_endpoints_restart_persist', 'A1/A2 reopen same two-member MLS group')

    // Serialized encrypted traffic A1 -> A2.
    const c12 = path.join(A1_TO_A2, 'cipher-a1-to-a2.json')
    const text12 = `E2 A1->A2 ${crypto.randomUUID()}`
    const enc12 = run(['encrypt', 'a1', c12, text12])
    assert(enc12.code === 0, `A1 encrypt failed: ${enc12.stderr}`)
    const dec12 = run(['decrypt', 'a2', c12])
    const dec12j = parseLastJson(dec12.stdout)
    assert(dec12.code === 0 && dec12j?.plaintext === text12, 'A2 failed to decrypt serialized A1 traffic')
    pass('post_restart_serialized_a1_to_a2')

    // Serialized encrypted traffic A2 -> A1.
    const c21 = path.join(A2_TO_A1, 'cipher-a2-to-a1.json')
    const text21 = `E2 A2->A1 ${crypto.randomUUID()}`
    const enc21 = run(['encrypt', 'a2', c21, text21])
    assert(enc21.code === 0, `A2 encrypt failed: ${enc21.stderr}`)
    const dec21 = run(['decrypt', 'a1', c21])
    const dec21j = parseLastJson(dec21.stdout)
    assert(dec21.code === 0 && dec21j?.plaintext === text21, 'A1 failed to decrypt serialized A2 traffic')
    pass('post_restart_serialized_a2_to_a1')

    report.finishedAt = new Date().toISOString()
    report.summary = {
      result: 'PASS',
      separateProcesses: true,
      serializedTransport: true,
      rawPairingCodeNotInTransport: true,
      requestIntegrity: true,
      approvalIntegrity: true,
      replayNoop: true,
      restartPersistence: true,
      bidirectionalEncryptedTraffic: true,
      liveWorkspaceModified: false,
    }
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n', 'utf8')

    console.log('')
    console.log('RESULT: SECOND DEVICE ENROLLMENT TRANSPORT CONTRACT IS PROVEN IN THE SANDBOX.')
    console.log('A1 and A2 ran as independent processes, exchanged only serialized envelopes,')
    console.log('tampering/replay were blocked, OOB secret stayed out of transport, and restart traffic passed.')
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
    try { fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n', 'utf8') } catch {}
    throw error
  } finally {
    if (server) {
      try { await stopA1Server(server) } catch {}
    }
  }
}

main().catch((error) => {
  console.error('')
  console.error('ENROLLMENT TRANSPORT LAB FAILED:', error?.stack || error)
  process.exitCode = 1
})
