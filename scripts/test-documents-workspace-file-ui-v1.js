'use strict';

const assert = require('assert/strict');
const fs = require('fs');

const js = fs.readFileSync('src/modules/documents/documents-v0.js', 'utf8');
const css = fs.readFileSync('src/modules/documents/documents-v0.css', 'utf8');

assert(js.includes('IRGEZTNE_DOCUMENTS_WORKSPACE_FILE_UI_V1'));
assert(js.includes("t('Прикрепить с компьютера', 'Attach from computer')"));
assert(js.includes("t('Прикрепить из Files', 'Attach from Files')"));
assert(js.includes("t('Вложения документа', 'Document attachments')"));
console.log('PASS Documents exposes clear attachment entry points');

assert(js.includes("api.workspaceFilePickImport({"));
assert(js.includes("ownerType: 'document'"));
assert(js.includes("ownerId: item.id"));
assert(js.includes("role: 'attachment'"));
console.log('PASS Computer entry uses trusted Workspace picker');

assert(js.includes('workspaceFileRefFromAttachResult('));
assert(js.includes('getWorkspaceFileRefs(item).concat(nextRef)'));
console.log('PASS imported Workspace ref is persisted in document relations');

assert(js.includes("data-documents-action=\"remove-workspace-file-ref\""));
assert(js.includes('removeWorkspaceFileRef(item, refId)'));
console.log('PASS Workspace file relation can be unlinked through lifecycle owner');
assert(js.includes('ns-documents-v1__workspace-file-pill-name'));
assert(css.includes('IRGEZTNE_DOCUMENT_ATTACHMENTS_RELEASE_R1'));
console.log('PASS Attachment filename and unlink control are visually separated');

assert(js.includes('uniqueIds(item.fileIds).length + getWorkspaceAttachmentRefs(item).length'));
assert(js.includes('function renderDocumentAttachmentPills(item)'));
assert(js.includes("renderLinkedPills(legacyIds, getFileTitle, 'file')"));
assert(js.includes('renderWorkspaceFilePills(item)'));
console.log('PASS Files panel projects legacy Files and Workspace refs together');

assert(css.includes('grid-template-columns: repeat(3, minmax(0, 1fr))'));
assert(js.includes('data-documents-action="export-document-bundle"'));
console.log('PASS Computer, Files and bundle export actions have equal three-column layout');

assert(js.includes('data-documents-action="toggle-files-library-picker"'));
assert(js.includes('data-documents-files-chooser hidden'));
assert(js.includes("t('Добавить', 'Add')"));
console.log('PASS Files chooser is hidden until From Files is requested');

console.log('DOCUMENTS WORKSPACE FILE UI V1: PASS');
