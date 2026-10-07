import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const RUNTIME = path.join(PROJECT_ROOT, 'src', 'messenger', 'native-runtime')
const CLIENT_PATH = path.join(RUNTIME, 'secure-local-service-client.mjs')
const BINARY = path.join(
  RUNTIME,
  `irgeztne-green-lightning-secure-local-service-v04n${process.platform === 'win32' ? '.exe' : ''}`
)
const LAB_ROOT = path.join(
  os.homedir(),
  'Загрузки',
  '_IRGEZTNE_LABS',
  'messenger-second-device-enrollment-v01'
)
const PREFIX = 'com.irgeztne.green-lightning.sandbox.enrollment.v01'

if (fs.existsSync(CLIENT_PATH) && fs.existsSync(BINARY)) {
  const mod = await import(pathToFileURL(CLIENT_PATH).href)
  for (const slot of ['a1', 'a2']) {
    try {
      mod.deleteRootKey({
        keyringService: `${PREFIX}.${slot}`,
        binaryPath: BINARY,
      })
    } catch {}
  }
}
try { fs.rmSync(LAB_ROOT, { recursive: true, force: true }) } catch {}
console.log('OK: second-device enrollment sandbox removed.')
console.log('Live Workspace Messenger/account data were not touched.')
