import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const RUNTIME_DIR = path.join(PROJECT_ROOT, 'src', 'messenger', 'native-runtime')
const CLIENT_PATH = path.join(RUNTIME_DIR, 'secure-local-service-client.mjs')
const BINARY_SUFFIX = process.platform === 'win32' ? '.exe' : ''
const BINARY_PATH = path.join(
  RUNTIME_DIR,
  `irgeztne-green-lightning-secure-local-service-v04n${BINARY_SUFFIX}`
)
const LAB_ROOT = path.join(os.homedir(), 'Загрузки', '_IRGEZTNE_LABS', 'messenger-device-lab-v01')
const PREFIX = 'com.irgeztne.green-lightning.sandbox.device-lab.v01'
const services = ['a1', 'a2', 'b1', 'c1'].map((slot) => `${PREFIX}.${slot}`)

const mod = await import(pathToFileURL(CLIENT_PATH).href)
for (const keyringService of services) {
  try { mod.deleteRootKey({ keyringService, binaryPath: BINARY_PATH }) } catch {}
}
fs.rmSync(LAB_ROOT, { recursive: true, force: true })
console.log('OK: Messenger Device Lab data + sandbox root keys removed.')
console.log('Main Workspace Messenger data was not touched.')
