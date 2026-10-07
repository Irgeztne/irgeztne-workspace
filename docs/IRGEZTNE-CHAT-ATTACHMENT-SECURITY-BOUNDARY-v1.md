# IRGEZTNE Chat — attachment security boundary v1

This note freezes the contract for the next Attachments pass. It does not add file picking, blob storage, microphone access, or attachment UI.

## Protected event envelope

Existing plain-text history and the current text-v1 wire format remain readable. New protected message content uses the same versioned envelope and one of these explicit kinds:

- `text`: text body and optional canonical reply reference;
- `attachment`: `blobId`, display `name`, `mimeType`, `sizeBytes`, and lowercase SHA-256 `sha256`;
- `voice-note`: `blobId`, audio `mimeType`, `sizeBytes`, `durationMs`, and lowercase SHA-256 `sha256`.

Attachment metadata belongs inside the MLS-protected event. Raw file bytes, external filesystem paths, and renderer-supplied reply snapshots do not belong in message history. The current schema limits are 25 MiB per attachment, 15 MiB and 15 minutes per voice note; the implementation pass may tighten MIME allowlists without widening these limits.

## Trusted file boundary

The renderer must never receive arbitrary filesystem access. Future selection must use a narrow preload capability backed by trusted-sender IPC. The main process returns only an opaque operation/blob identifier plus validated display metadata, never a durable external path.

Selected content is copied into app-owned staging, encrypted before durable storage, addressed by an unpredictable `blobId`, and committed atomically. The blob encryption key remains in app-owned secure storage. A content hash is calculated from the selected bytes, protected in the event metadata, and verified after decryption before open/export.

## Lifecycle and cleanup

1. Select through trusted IPC, validate size/type, copy to private staging, hash, and encrypt.
2. Commit the encrypted blob, then send the MLS-protected metadata event. Retry uses the same operation identifier so it cannot create duplicate blobs or events.
3. On restart, reconcile incomplete staging/commit records: resume a safe retry or remove abandoned temporary files.
4. `delete-for-all` creates the existing tombstone and releases the blob reference for eventual garbage collection. `hide-for-me` remains a local projection and must not destroy content still referenced by shared history.
5. A revoked/inactive device cannot select, stage, upload, fetch, or send new protected attachment operations. Previously accepted encrypted history remains readable only where the current revocation/history contract already permits it.

Temporary decrypted exports must use restrictive permissions, short lifetimes, and cleanup on completion, failure, startup recovery, and application shutdown.
