'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const MAX_ENTRY_COUNT = 256;
const MAX_TEXT_BYTES = 16 * 1024 * 1024;
const MAX_TOTAL_BYTES = 512 * 1024 * 1024;

let crcTable = null;

function getCrcTable() {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  crcTable = table;
  return table;
}

function crc32(buffer) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(dateValue) {
  const date = dateValue instanceof Date ? dateValue : new Date();
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);
  return {
    date: (((year - 1980) << 9) | (month << 5) | day) & 0xffff,
    time: ((hours << 11) | (minutes << 5) | seconds) & 0xffff
  };
}

function cleanEntryName(value) {
  const raw = String(value == null ? '' : value)
    .replace(/\\/g, '/')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/^\/+/, '')
    .trim();
  const parts = raw.split('/').filter((part) => part && part !== '.' && part !== '..');
  const cleaned = parts.join('/');
  if (!cleaned || cleaned.length > 500) {
    const error = new TypeError('Invalid bundle entry name');
    error.code = 'DOCUMENT_BUNDLE_INVALID_ENTRY';
    throw error;
  }
  return cleaned;
}

function cleanSuggestedName(value) {
  const text = String(value == null ? '' : value)
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
  return text || 'document';
}

function toTextBuffer(value, label) {
  const text = typeof value === 'string' ? value : String(value == null ? '' : value);
  const buffer = Buffer.from(text, 'utf8');
  if (buffer.length > MAX_TEXT_BYTES) {
    const error = new RangeError(`${label} is too large`);
    error.code = 'DOCUMENT_BUNDLE_TEXT_TOO_LARGE';
    throw error;
  }
  return buffer;
}

function buildStoredZip(entries) {
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > MAX_ENTRY_COUNT) {
    const error = new RangeError('Invalid ZIP entry count');
    error.code = 'DOCUMENT_BUNDLE_INVALID_ENTRY_COUNT';
    throw error;
  }

  const localParts = [];
  const centralParts = [];
  let offset = 0;

  entries.forEach((entry) => {
    const name = cleanEntryName(entry.name);
    const nameBytes = Buffer.from(name, 'utf8');
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data || []);
    const crc = crc32(data);
    const dt = dosDateTime(entry.mtime);

    if (data.length > 0xffffffff) {
      const error = new RangeError('ZIP64 is not supported');
      error.code = 'DOCUMENT_BUNDLE_ENTRY_TOO_LARGE';
      throw error;
    }

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dt.time, 10);
    localHeader.writeUInt16LE(dt.date, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBytes, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dt.time, 12);
    centralHeader.writeUInt16LE(dt.date, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBytes);
    offset += localHeader.length + nameBytes.length + data.length;
  });

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat(localParts.concat(centralParts, [eocd]));
}

function uniqueEntryName(baseName, used) {
  let candidate = cleanEntryName(baseName);
  if (!used.has(candidate.toLowerCase())) {
    used.add(candidate.toLowerCase());
    return candidate;
  }

  const slash = candidate.lastIndexOf('/');
  const dir = slash >= 0 ? candidate.slice(0, slash + 1) : '';
  const leaf = slash >= 0 ? candidate.slice(slash + 1) : candidate;
  const dot = leaf.lastIndexOf('.');
  const stem = dot > 0 ? leaf.slice(0, dot) : leaf;
  const ext = dot > 0 ? leaf.slice(dot) : '';

  for (let index = 2; index < 1000; index += 1) {
    const next = `${dir}${stem} (${index})${ext}`;
    if (!used.has(next.toLowerCase())) {
      used.add(next.toLowerCase());
      return next;
    }
  }

  const error = new Error('Could not allocate unique bundle entry name');
  error.code = 'DOCUMENT_BUNDLE_NAME_COLLISION';
  throw error;
}

function registerDocumentBundleIpc(options) {
  const {
    ipcMain,
    dialog,
    BrowserWindow,
    assertTrustedSender,
    getStorageCore,
    dataDir
  } = options || {};

  if (!ipcMain || !dialog || !BrowserWindow || !assertTrustedSender || !getStorageCore || !dataDir) {
    throw new Error('Document bundle IPC dependencies are incomplete');
  }

  ipcMain.handle('ns:office:exportDocumentBundle', async (event, payload = {}) => {
    try {
      assertTrustedSender(event);

      const title = cleanSuggestedName(payload.title || 'document');
      const markdown = toTextBuffer(payload.markdown || '', 'Markdown');
      const html = toTextBuffer(payload.html || '', 'HTML');
      const refs = Array.isArray(payload.files) ? payload.files : [];

      if (refs.length > MAX_ENTRY_COUNT - 2) {
        const error = new RangeError('Too many document attachments');
        error.code = 'DOCUMENT_BUNDLE_TOO_MANY_FILES';
        throw error;
      }

      const storage = getStorageCore();
      const root = path.resolve(dataDir);
      const entries = [
        { name: 'document.md', data: markdown },
        { name: 'document.html', data: html }
      ];
      const usedNames = new Set(['document.md', 'document.html']);
      let totalBytes = markdown.length + html.length;

      for (const ref of refs) {
        const fileId = String(ref && ref.fileId || '').trim();
        if (!fileId || fileId.length > 200 || /[\u0000-\u001f\u007f]/.test(fileId)) {
          const error = new TypeError('Invalid Workspace file id');
          error.code = 'DOCUMENT_BUNDLE_INVALID_FILE_ID';
          throw error;
        }

        const file = storage.getWorkspaceFile(fileId);
        if (!file || file.blobState !== 'ready') {
          const error = new Error('Workspace attachment is unavailable');
          error.code = 'DOCUMENT_BUNDLE_FILE_NOT_FOUND';
          throw error;
        }

        const sourcePath = path.resolve(root, String(file.storageRelpath || ''));
        if (sourcePath === root || !sourcePath.startsWith(root + path.sep)) {
          const error = new Error('Workspace attachment path is invalid');
          error.code = 'DOCUMENT_BUNDLE_INVALID_PATH';
          throw error;
        }

        const stat = await fsp.stat(sourcePath);
        if (!stat.isFile()) {
          const error = new Error('Workspace attachment is not a file');
          error.code = 'DOCUMENT_BUNDLE_FILE_NOT_FOUND';
          throw error;
        }

        totalBytes += stat.size;
        if (totalBytes > MAX_TOTAL_BYTES) {
          const error = new RangeError('Document bundle is too large');
          error.code = 'DOCUMENT_BUNDLE_TOO_LARGE';
          throw error;
        }

        const folder = ref && ref.kind === 'asset' ? 'assets' : 'attachments';
        const requestedName = cleanSuggestedName(
          ref && ref.name || file.displayName || file.originalName || fileId
        );
        const entryName = uniqueEntryName(`${folder}/${requestedName}`, usedNames);
        const data = await fsp.readFile(sourcePath);
        entries.push({ name: entryName, data, mtime: stat.mtime });
      }

      const archive = buildStoredZip(entries);
      const owner = BrowserWindow.fromWebContents(event.sender);
      const picked = await dialog.showSaveDialog(owner || undefined, {
        title: 'Export document package / Экспорт комплекта документа',
        defaultPath: `${title}.zip`,
        filters: [{ name: 'ZIP archive', extensions: ['zip'] }]
      });

      if (picked.canceled || !picked.filePath) {
        return { ok: false, canceled: true };
      }

      await fsp.writeFile(picked.filePath, archive);

      return {
        ok: true,
        canceled: false,
        fileName: path.basename(picked.filePath),
        entryCount: entries.length
      };
    } catch (error) {
      const rawCode = String(error && error.code ? error.code : 'DOCUMENT_BUNDLE_EXPORT_FAILED');
      const code = /^[A-Z0-9_]{1,80}$/.test(rawCode)
        ? rawCode
        : 'DOCUMENT_BUNDLE_EXPORT_FAILED';
      console.warn('[IRGEZTNE Document Bundle]', code, error && error.message ? error.message : error);
      return { ok: false, canceled: false, error: { code } };
    }
  });
}

module.exports = {
  registerDocumentBundleIpc,
  _test: { buildStoredZip, crc32 }
};
