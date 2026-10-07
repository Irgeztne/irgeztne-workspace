import { spawn, spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const MAX_HOST_IPC_BYTES = 4_194_304

export function defaultSecureLocalServiceBinary() {
  const suffix = process.platform === 'win32' ? '.exe' : ''
  return path.join(
    root,
    'target',
    'debug',
    `irgeztne-green-lightning-secure-local-service-v04n${suffix}`
  )
}

export function deleteRootKey({
  keyringService,
  binaryPath = defaultSecureLocalServiceBinary(),
}) {
  return spawnSync(
    binaryPath,
    ['delete-root', keyringService],
    {
      encoding: 'utf8',
      env: process.env,
    }
  )
}

export class SecureLocalServiceError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'SecureLocalServiceError'
    this.code = code
  }
}

export class SecureLocalServiceClient {
  constructor({
    dataDir,
    identity,
    keyringService,
    binaryPath = defaultSecureLocalServiceBinary(),
  }) {
    if (!dataDir) throw new Error('dataDir is required')
    if (!identity) throw new Error('identity is required')
    if (!keyringService) throw new Error('keyringService is required')

    this.dataDir = dataDir
    this.identity = identity
    this.keyringService = keyringService
    this.binaryPath = binaryPath

    this.child = null
    this.nextId = 1
    this.pending = new Map()
    this.stderr = ''
    this.closed = false
  }

  async start() {
    if (this.child) return this

    this.closed = false

    const child = spawn(
      this.binaryPath,
      [
        '--data-dir', this.dataDir,
        '--identity', this.identity,
        '--keyring-service', this.keyringService,
      ],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      }
    )

    this.child = child

    const lines = createInterface({
      input: child.stdout,
      crlfDelay: Infinity,
    })

    lines.on('line', (line) => {
      let message

      try {
        message = JSON.parse(line)
      } catch {
        this.#failAll(
          new Error('secure-local-service emitted non-JSON stdout')
        )
        return
      }

      const waiter = this.pending.get(message.id)
      if (!waiter) return

      this.pending.delete(message.id)

      if (message.ok) {
        waiter.resolve(message.result)
      } else {
        waiter.reject(
          new SecureLocalServiceError(
            message.error?.code || 'SECURE_LOCAL_SERVICE_ERROR',
            message.error?.message || 'secure-local-service request failed'
          )
        )
      }
    })

    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk) => {
      this.stderr += chunk
      if (this.stderr.length > 64 * 1024) {
        this.stderr = this.stderr.slice(-64 * 1024)
      }
    })

    // IRGEZTNE_IPC_EPIPE_HARDENING_V04H1
    // A broken child stdin (for example EPIPE after the native service exits)
    // is an EventEmitter error. Without a listener Electron treats it as an
    // uncaught exception even when write() also reports the error by callback.
    child.stdin.on('error', (error) => {
      if (this.closed) return

      const code = String(error?.code || 'IPC_STDIN_ERROR')
      const message = String(error?.message || error || 'unknown stdin error')

      this.#failAll(
        new SecureLocalServiceError(
          code,
          `secure-local-service stdin failed: ${message}`
        )
      )
    })

    const ready = new Promise((resolve, reject) => {
      child.once('spawn', resolve)
      child.once('error', reject)
      child.once('exit', (code, signal) => {
        if (code !== null && code !== 0) {
          reject(
            new Error(
              `secure-local-service failed during start ` +
              `(code=${code}, signal=${signal}): ${this.stderr}`
            )
          )
        }
      })
    })

    child.on('exit', (code, signal) => {
      const expected = this.closed
      this.child = null

      if (!expected) {
        const detail = this.stderr.trim()
          ? `\nstderr:\n${this.stderr.trim()}`
          : ''

        this.#failAll(
          new Error(
            `secure-local-service exited unexpectedly ` +
            `(code=${code}, signal=${signal})${detail}`
          )
        )
      }
    })

    await ready

    try {
      await this.ping()
    } catch (error) {
      const detail = this.stderr.trim()
        ? `\nstderr:\n${this.stderr.trim()}`
        : ''

      const message = String(error?.message || error)

      if (detail && !message.includes(this.stderr.trim())) {
        throw new Error(`${message}${detail}`)
      }

      throw error
    }

    return this
  }

  #failAll(error) {
    for (const waiter of this.pending.values()) {
      waiter.reject(error)
    }
    this.pending.clear()
  }

  request(op, fields = {}) {
    const child = this.child
    const stdin = child?.stdin

    if (
      !child ||
      !stdin ||
      this.closed ||
      stdin.destroyed ||
      stdin.writableEnded ||
      stdin.writableFinished
    ) {
      return Promise.reject(
        new SecureLocalServiceError(
          'IPC_NOT_WRITABLE',
          'secure-local-service is not running or its IPC stdin is closed'
        )
      )
    }

    const id = this.nextId++
    const payload = JSON.stringify({ id, op, ...fields })

    if (Buffer.byteLength(payload, 'utf8') > MAX_HOST_IPC_BYTES) {
      return Promise.reject(
        new SecureLocalServiceError(
          'IPC_LIMIT',
          'secure-local-service request exceeds host IPC limit'
        )
      )
    }

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })

      const failWrite = (error) => {
        const waiter = this.pending.get(id)
        if (!waiter) return

        this.pending.delete(id)

        const code = String(error?.code || 'IPC_WRITE_ERROR')
        const message = String(error?.message || error || 'unknown IPC write error')

        waiter.reject(
          new SecureLocalServiceError(
            code,
            `secure-local-service IPC write failed: ${message}`
          )
        )
      }

      try {
        stdin.write(`${payload}\n`, (error) => {
          if (error) failWrite(error)
        })
      } catch (error) {
        failWrite(error)
      }
    })
  }

  // Crypto
  ping() { return this.request('ping') }
  securityStatus() { return this.request('security_status') }
  keyPackage() { return this.request('key_package') }

  createGroup(conversationId) {
    return this.request('create_group', {
      conversation_id: conversationId,
    })
  }

  addMember(conversationId, keyPackageHex) {
    return this.request('add_member', {
      conversation_id: conversationId,
      key_package_hex: keyPackageHex,
    })
  }

  async removeMember(conversationId, memberIdentity) {
    if (
      typeof conversationId !== 'string' ||
      !conversationId ||
      conversationId.length > 128 ||
      !/^[A-Za-z0-9_.:/-]+$/.test(conversationId)
    ) {
      throw new TypeError('invalid Messenger conversation id')
    }

    if (
      typeof memberIdentity !== 'string' ||
      !memberIdentity ||
      Buffer.byteLength(memberIdentity, 'utf8') > 65_536
    ) {
      throw new TypeError('invalid Messenger member identity')
    }

    const result = await this.request('remove_member', {
      conversation_id: conversationId,
      member_identity: memberIdentity,
    })

    if (
      !result ||
      (result.result !== 'REMOVED' && result.result !== 'NOT_PRESENT') ||
      result.conversation_id !== conversationId ||
      result.removed_member_identity !== memberIdentity
    ) {
      throw new SecureLocalServiceError(
        'REMOVE_MEMBER_CONTRACT_ERROR',
        'secure-local-service returned an invalid remove_member result'
      )
    }

    if (result.result === 'REMOVED') {
      if (typeof result.commit_hex !== 'string' || !result.commit_hex) {
        throw new SecureLocalServiceError(
          'REMOVE_MEMBER_CONTRACT_ERROR',
          'REMOVED result is missing commit_hex'
        )
      }
    } else if (result.commit_hex !== null) {
      throw new SecureLocalServiceError(
        'REMOVE_MEMBER_CONTRACT_ERROR',
        'NOT_PRESENT result must not contain commit_hex'
      )
    }

    return Object.freeze({
      result: result.result,
      conversationId: result.conversation_id,
      memberIdentity: result.removed_member_identity,
      commitHex: result.commit_hex,
      epoch: Number(result.epoch),
      members: Number(result.members),
      active: Boolean(result.active),
    })
  }

  joinGroup(conversationId, welcomeHex) {
    return this.request('join_group', {
      conversation_id: conversationId,
      welcome_hex: welcomeHex,
    })
  }

  applyCommit(conversationId, commitHex) {
    return this.request('apply_commit', {
      conversation_id: conversationId,
      commit_hex: commitHex,
    })
  }

  encrypt(conversationId, plaintext) {
    return this.request('encrypt', {
      conversation_id: conversationId,
      plaintext,
    })
  }

  decrypt(conversationId, messageHex) {
    return this.request('decrypt', {
      conversation_id: conversationId,
      message_hex: messageHex,
    })
  }

  groupStatus(conversationId) {
    return this.request('group_status', {
      conversation_id: conversationId,
    })
  }

  // Encrypted message store
  async stageOutgoing(record) {
    await this.request('store_stage_outgoing', { record })
  }

  updateOutgoing(messageId, patch) {
    return this.request('store_update_outgoing', {
      message_id: messageId,
      patch,
    })
  }

  advanceOutgoingStatus(messageId, status, patch = {}) {
    return this.request('store_advance_outgoing_status', {
      message_id: messageId,
      status,
      patch,
    })
  }

  async getOutgoing(messageId) {
    const value = await this.request('store_get_outgoing', {
      message_id: messageId,
    })
    return value ?? null
  }

  listOutgoing() {
    return this.request('store_list_outgoing')
  }

  listOutbox() {
    return this.request('store_list_outbox')
  }

  async hasInbox(messageId) {
    const value = await this.request('store_has_inbox', {
      message_id: messageId,
    })
    return Boolean(value?.found)
  }

  async addInbox(messageId, record) {
    if (messageId !== record?.message_id) {
      throw new Error('inbox message_id mismatch')
    }
    const value = await this.request('store_add_inbox', {
      record,
    })
    return Boolean(value?.inserted)
  }

  async getInbox(messageId) {
    const value = await this.request('store_get_inbox', {
      message_id: messageId,
    })
    return value ?? null
  }

  listInbox() {
    return this.request('store_list_inbox')
  }

  markInboxRead(messageId, readAt) {
    return this.request('store_mark_inbox_read', {
      message_id: messageId,
      read_at: readAt,
    })
  }

  async addError(record) {
    await this.request('store_add_error', { record })
  }

  listErrors() {
    return this.request('store_list_errors')
  }

  snapshot() {
    return this.request('store_snapshot')
  }

  async close() {
    if (!this.child) return

    const child = this.child

    try {
      await this.request('shutdown')
    } catch {
      // Continue cleanup.
    }

    this.closed = true

    if (child && child.exitCode === null) {
      await new Promise((resolve) => {
        const timer = setTimeout(() => {
          try { child.kill('SIGTERM') } catch {}
          resolve()
        }, 1500)

        child.once('exit', () => {
          clearTimeout(timer)
          resolve()
        })
      })
    }

    this.child = null
  }

  async killForIsolationTest() {
    if (!this.child) return

    const child = this.child
    this.closed = true

    await new Promise((resolve) => {
      child.once('exit', resolve)
      child.kill(process.platform === 'win32' ? undefined : 'SIGKILL')
    })

    this.child = null
  }
}
