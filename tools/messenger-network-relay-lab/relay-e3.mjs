import http from 'node:http'
import crypto from 'node:crypto'

const host = '127.0.0.1'
const port = Number(process.env.E3_RELAY_PORT || 0)
const MAX_BODY = 1024 * 1024

const mailboxes = new Map()
const attacks = new Map()
const trace = []
let seq = 0

function send(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  res.end(body)
}

async function readJson(req) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > MAX_BODY) throw new Error('body too large')
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

function box(name) {
  if (!mailboxes.has(name)) mailboxes.set(name, [])
  return mailboxes.get(name)
}

function mutateHex(value) {
  const text = String(value || '')
  if (text.length < 2) return '00'
  const first = text[0].toLowerCase() === 'a' ? 'b' : 'a'
  return first + text.slice(1)
}

function applyAttack(mailbox, payload) {
  const mode = attacks.get(mailbox)
  if (!mode) return { payload, attacked: false }

  attacks.delete(mailbox)
  const out = JSON.parse(JSON.stringify(payload))

  if (mode === 'flip-keypackage' && typeof out.keyPackageHex === 'string') {
    out.keyPackageHex = mutateHex(out.keyPackageHex)
  } else if (mode === 'flip-welcome' && typeof out.welcomeHex === 'string') {
    out.welcomeHex = mutateHex(out.welcomeHex)
  } else if (mode === 'flip-proof' && typeof out.proof === 'string') {
    out.proof = mutateHex(out.proof)
  }

  return { payload: out, attacked: true, mode }
}

function push(mailbox, payload, meta = {}) {
  seq += 1
  const item = {
    seq,
    receivedAt: new Date().toISOString(),
    payload,
  }
  box(mailbox).push(item)
  trace.push({
    seq,
    mailbox,
    receivedAt: item.receivedAt,
    payload,
    ...meta,
  })
  return item
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${host}`)
    const parts = url.pathname.split('/').filter(Boolean)

    if (
      req.method === 'GET' &&
      (url.pathname === '/' || url.pathname === '/health')
    ) {
      return send(res, 200, {
        ok: true,
        relay: 'irgeztne-e3-untrusted-relay',
        status: 'ready',
        messages: trace.length,
      })
    }

    if (req.method === 'GET' && url.pathname === '/lab/trace') {
      return send(res, 200, { ok: true, trace })
    }

    if (req.method === 'POST' && url.pathname === '/lab/attack') {
      const body = await readJson(req)
      if (!body.mailbox || !body.mode) {
        return send(res, 400, { ok: false, error: 'mailbox + mode required' })
      }
      attacks.set(String(body.mailbox), String(body.mode))
      return send(res, 200, { ok: true })
    }

    if (req.method === 'POST' && url.pathname === '/lab/replay') {
      const body = await readJson(req)
      const mailbox = String(body.mailbox || '')
      const fromSeq = Number(body.seq)
      const source = trace.find((item) => item.seq === fromSeq && item.mailbox === mailbox)
      if (!source) return send(res, 404, { ok: false, error: 'source message not found' })
      const item = push(mailbox, JSON.parse(JSON.stringify(source.payload)), {
        replayOf: fromSeq,
        attacked: true,
        attackMode: 'replay',
      })
      return send(res, 200, { ok: true, seq: item.seq })
    }

    if (parts[0] === 'mailbox' && parts[1]) {
      const mailbox = decodeURIComponent(parts[1])

      if (req.method === 'POST') {
        const body = await readJson(req)
        const attacked = applyAttack(mailbox, body)
        const item = push(mailbox, attacked.payload, {
          attacked: attacked.attacked,
          attackMode: attacked.mode || null,
        })
        return send(res, 200, { ok: true, seq: item.seq })
      }

      if (req.method === 'GET') {
        const after = Number(url.searchParams.get('after') || 0)
        const items = box(mailbox).filter((item) => item.seq > after)
        return send(res, 200, { ok: true, items })
      }
    }

    send(res, 404, { ok: false, error: 'not found' })
  } catch (error) {
    send(res, 500, { ok: false, error: String(error?.message || error) })
  }
})

server.listen(port, host, () => {
  const address = server.address()
  console.log(`E3_RELAY_READY:${JSON.stringify({
    ok: true,
    url: `http://${host}:${address.port}`,
  })}`)
})

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
  })
}
