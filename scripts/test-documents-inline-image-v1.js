#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');

const main = fs.readFileSync('main.js', 'utf8');
const preload = fs.readFileSync('preload.js', 'utf8');
const docs = fs.readFileSync(
  'src/modules/documents/documents-v0.js',
  'utf8'
);
const css = fs.readFileSync(
  'src/modules/documents/documents-v0.css',
  'utf8'
);

assert(main.includes('IRGEZTNE_WORKSPACE_ASSET_PROTOCOL_V1'));
assert(main.includes("scheme: 'irgeztne-asset'"));
assert(main.includes("protocol.handle('irgeztne-asset'"));
console.log('PASS internal Workspace asset protocol is registered');

assert(main.includes("url.hostname !== 'workspace-file'"));
assert(main.includes("file.blobState !== 'ready'"));
assert(main.includes('WORKSPACE_IMAGE_MIME_BY_EXTENSION'));
assert(main.includes('X-Content-Type-Options'));
assert(!main.includes("scheme: 'file'"));
console.log('PASS protocol serves only ready allowlisted raster assets');

assert(main.includes("payload.intent === 'image'"));
assert(main.includes("extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif']"));
console.log('PASS image insertion uses image-only system picker');

assert(docs.includes("t('Вставить изображение', 'Insert image')"));
assert(docs.includes("data-documents-action=\"insert-workspace-image\""));
assert(docs.includes("role: 'image'"));
console.log('PASS Documents exposes real inline-image action');

assert(docs.includes("'irgeztne-asset://workspace-file/'"));
assert(docs.includes("data-workspace-file-id"));
assert(docs.includes('reconcileWorkspaceImageRefs'));
console.log('PASS inline image persists by fileId and participates in ref lifecycle');

assert(docs.includes('getWorkspaceAttachmentRefs(item)'));
assert(css.includes('ns-documents-v1__inline-image'));
console.log('PASS inline images stay separate from Attachments UI');

assert(preload.includes('workspaceFilePickImport'));
console.log('PASS renderer still uses narrow preload capability');

console.log('DOCUMENTS INLINE IMAGE V1: PASS');
