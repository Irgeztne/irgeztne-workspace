import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const LIVE_CLIENT_PATH = path.join(
  PROJECT_ROOT,
  'src',
  'messenger',
  'native-runtime',
  'secure-local-service-client.mjs'
)
const BINARY_SUFFIX = process.platform === 'win32' ? '.exe' : ''
const LAB_BINARY = path.join(
  __dirname,
  'native-source',
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
const PREFIX = 'com.irgeztne.green-lightning.sandbox.device-lab.v04'
const SERVICES = ['a1', 'a2', 'b1', 'c1'].map((slot) => `${PREFIX}.${slot}`)

if (fs.existsSync(LIVE_CLIENT_PATH) && fs.existsSync(LAB_BINARY)) {
  const mod = await import(pathToFileURL(LIVE_CLIENT_PATH).href)
  for (const keyringService of SERVICES) {
    try {
      mod.deleteRootKey({
        keyringService,
        binaryPath: LAB_BINARY,
      })
    } catch {}
  }
}

try { fs.rmSync(LAB_ROOT, { recursive: true, force: true }) } catch {}
console.log('OK: L4 sandbox data/root-key namespace removed.')
console.log('Live Workspace Messenger data/binary were not touched.')
