# IRGEZTNE Web Studio Package Contract v1

**Status:** Normative release-candidate contract / R1W9F Component-adapter profile  
**Date:** 2026-09-05  
**Foundation:** `IRGEZTNE-WORKSHOP-WEB-STUDIO-CYCLE-CONTRACT-v1.md`  
**Scope:** Website packages installed by Workshop and consumed by Web Studio

---

## 1. Prime invariant

A package describes **what it is, what it contains, and what it requires**.

A package MUST NOT describe Web Studio private storage paths, renderer internals, Electron objects, Workspace stores, or implementation-specific destination folders.

Routing and use are owned by public adapters:

```text
Author package -> Workshop validation/install -> public adapter -> Web Studio surface -> user action
```

This contract refines the frozen Workshop ↔ Web Studio foundation; it does not replace or widen it.

---

## 2. Package families enabled by the v1 foundation

Exactly four website-package families belong to Workshop 1.0:

| `package.type` | Natural Web Studio destination | User action |
|---|---|---|
| `template` | Templates → Installed | Create site from template |
| `theme` | Design → Themes | Apply theme |
| `component` | Editor → Components / Blocks | Insert block/component |
| `widget` | Web Studio → Site Widgets | Configure placement and create a functional Site Widget Instance |

Aliases may be normalized internally (`block` -> `component`, `site-widget` -> `widget`), but exported public manifests SHOULD use the canonical values above.

Native Workspace modules, Electron extensions, Node.js plugins and arbitrary application plugins are outside this contract.

---

## 3. Base manifest envelope

The transport container is a ZIP with `irgeztne-package.json` at the ZIP root.

The existing envelope remains valid:

- `format`: `irgeztne-workshop-package`
- `formatVersion`: package-schema version
- `package.id`: stable package identity
- `package.type`: one canonical website-package family
- `package.title`: display title
- `package.version`: package release version
- `package.author`: descriptive author metadata
- `package.license`: package license
- `package.description`: short/full description
- `package.tags`: free discovery tags
- `package.distribution`: local/public distribution mode
- `package.preview`: cover/gallery/presentation metadata
- `package.compatibility`: supported Web Studio/Workspace boundary
- `files[]`: complete declared file set with integrity metadata

Current valid exported packages remain valid under this contract. R1W9B does not require a package-format migration.

---

## 4. Schema version and package version are different

`formatVersion` and `package.version` MUST never be conflated.

- `formatVersion` means: **which manifest/package schema is this?**
- `package.version` means: **which release of this package is this?**

Compatibility rule:

- unsupported **major** `formatVersion` -> reject with an explicit unsupported-format error;
- known major + unknown optional fields -> preserve/ignore safely where possible;
- a future field that changes required interpretation must be guarded by a future required-feature mechanism, not silently guessed.

The installer MUST NOT reinterpret an unknown schema as the current schema merely because the ZIP parses as JSON.

---

## 5. Identity and versioning

`package.id` is immutable package identity.

Rules:

1. It is generated once and remains stable across releases.
2. Renaming `package.title` does not create a new identity.
3. A new published release reuses `package.id` and advances `package.version`.
4. `package.id + package.version` identifies one immutable release artifact.
5. Same id + same version MUST NOT silently overwrite an installed release.
6. Public submission MUST reject ownership collisions for an id already owned by another creator/publisher.

SemVer is preferred for package releases and required wherever the current validator marks it required.

---

## 6. Classification for routing and filtering

Three concepts have different jobs:

- `type` -> **where/how the package is used**;
- `category` -> **what kind of item it is inside that type**;
- `tags` -> **free search/filter vocabulary**.

Examples:

```text
template + blog + [editorial, magazine]
component + footer + [minimal, dark]
widget + form + [contact, lead]
theme + business + [light, blue]
```

`package.category` is a backward-compatible optional v1 field. If absent, local installation remains valid and the package is treated as `uncategorized` for filtering.

For public catalog publication, a suitable category SHOULD be required by catalog review even when older local ZIPs do not contain it.

Web Studio filtering SHOULD be driven by the safe adapter projection (`source`, `type`, `category`, `tags`, title), not by reading Workshop private storage.

---

## 7. Author, publisher and trust are separate

`package.author` is descriptive metadata inside the package. It is not proof of identity.

The public system distinguishes:

- **author/creator label**: what the package says;
- **verified publisher/account identity**: server-backed IRGEZTNE Account/catalog ownership;
- **install source**: local ZIP, official catalog, community catalog, etc.;
- **integrity**: whether bytes match the declared hashes.

SHA-256 proves byte integrity, not authorship or trust.

A local ZIP that says `author: Example Studio` MUST NOT be presented as a verified Example Studio account unless the catalog/account layer independently proves that identity.

Cryptographic package signing is reserved for a future trust layer and is not required to complete Workshop 1.0.

---

## 8. Files, integrity and archive safety

Every installed package is verified from actual bytes.

The v1 file contract remains:

- safe relative `/` path;
- role/kind;
- exact byte size;
- MIME type;
- lowercase SHA-256;
- no undeclared payload files;
- no path traversal;
- no dangerous executable/installable application payloads;
- bounded file count and unpacked size;
- ZIP CRC/structure validation.

No adapter may bypass Package Check by reading unverified ZIP bytes directly.

---

## 9. Rights and third-party notices

`package.license` describes the package as a whole, but bundled resources may carry separate obligations.

For Workshop 1.0:

- authors remain responsible for rights to bundled media/fonts/code;
- packages that require attribution or third-party notices SHOULD include a declared `THIRD-PARTY-NOTICES.md` (or equivalent declared notice file);
- public review may require provenance/rights evidence even when local installation is technically valid;
- local Package Check MUST NOT fabricate provenance that is not present.

Per-asset provenance can be strengthened later without changing the base ZIP identity model.

---

## 10. Package-to-package dependencies

Workshop 1.0 does **not** enable a package dependency manager.

A package MUST be installable and usable without automatically fetching another Workshop package.

Therefore:

- package-to-package dependencies are disabled for v1;
- a future `dependencies` field is reserved and MUST NOT silently activate downloads today;
- external web resources/APIs are a different concept and are handled as declared runtime dependencies/capabilities.

This prevents recursive installs, dependency conflicts and hidden update chains before a dedicated dependency architecture exists.

---

## 11. Capabilities and security boundary

Installation grants no Workspace privileges.

Always denied to website packages:

- Node.js APIs;
- Electron APIs;
- Workspace private stores;
- arbitrary filesystem access;
- account secrets;
- provider credentials.

Preview remains sandboxed and network-blocked by the current preview boundary.

A future network-capable site widget may declare site/runtime external origins, but this declaration does not grant desktop privileges and must be shown to the user before meaningful activation.

Unknown required capability -> explicit rejection, never silent privilege escalation.

---

## 12. Installed is not applied

The local states are intentionally separate:

```text
Author draft != exported ZIP != installed package != site-local instance
```

Installing a package only makes it available in the correct Web Studio library.

No install or update may silently modify an existing website.

---

## 13. v1 materialization rule: snapshot, not live-link

To keep removal/update behavior deterministic in Workspace 1.0, using an installed package creates a **site-local snapshot/materialized instance** by default.

| Type | v1 use semantics |
|---|---|
| Template | Create a new site from verified template bytes/model |
| Theme | Apply a site-local theme snapshot/state |
| Component | Insert a site-local component/block instance |
| Widget | Insert a site-local widget instance and its allowed site assets/config |

Consequences:

- uninstalling the library package does not delete already-created sites/blocks/widgets;
- updating the library package does not silently rewrite existing site instances;
- applying an update to an existing site is a separate explicit future migration/update action;
- no live package dependency graph is required for 1.0.

A future live-linked package class would require a new explicit contract and dependency/update semantics; it must not emerge accidentally from v1 behavior.

---

## 14. Update and rollback semantics

Update is an explicit action, not a disguised reinstall.

Before an installed-version pointer changes:

1. receive/read the candidate release;
2. verify manifest/schema;
3. verify every file, size and SHA-256;
4. verify compatibility/capabilities;
5. stage the candidate bytes;
6. atomically commit the new installed record only after all checks pass.

If any step fails, the previously installed valid release remains intact.

Same-version reinstall remains rejected unless a future explicit repair/replace action is defined.

---

## 15. Removal semantics

Removing a package removes the **installed library copy and registry state**.

It MUST NOT silently delete independent site-local materialized content created earlier from that package.

Removal itself is durable: after restart, an intentionally removed installed package must not resurrect from stale storage.

---

## 16. Type profiles and enablement gate

The Base Package Contract is common. Each type needs a smaller specialization before its **Use** action is considered release-complete:

- Template Contract
- Theme Contract
- Component/Block Contract
- Site Widget Contract

A type may be packageable before its Web Studio use adapter is complete, but the UI MUST NOT imply that its full install->use cycle is complete until the corresponding type profile and real adapter pass are proven.

Current state at R1W9G:

- `template`: R1W9D received real user PASS for Create/Apply snapshot semantics, including restart durability, source-package uninstall independence, local preview, external open and ZIP export; structured editable-model conversion and Backup Center transport of detached snapshot bytes remain separate;
- `theme`: R1W9E defines the declarative Theme Contract; the real user smoke passed install -> Design -> Apply -> restart durability -> source uninstall -> restart independence, so R1W9E is REAL PASS / FROZEN;
- `component`: R1W9F completed the real user smoke through insert/edit/delete/Undo/Redo, restart durability and source-package uninstall independence; **R1W9F Component adapter = REAL PASS / FROZEN**;
- `widget`: the frozen `IRGEZTNE-SITE-WIDGET-CONTRACT-v1.md` is authoritative. R1W9H reconciles the adapter to `Installed -> Configure -> Placement -> Site Widget Instance` with semantic Host Surfaces; REAL PASS still requires the real user smoke in `WEBSTUDIO-WIDGET-CONTRACT-v1.md`.

---

## 17. Public adapter boundary

Web Studio MUST NOT read Workshop localStorage, IndexedDB or private registry records directly.

The adapter returns a safe projection suitable for UI and use actions. For template creation, `NSCodeHubV1.materializeInstalledTemplateSnapshot(packageId)` re-verifies installed bytes and returns a bounded handoff payload; Web Studio then persists its own snapshot and must not continue reading Workshop private storage for the created site. For Theme apply, `NSCodeHubV1.materializeInstalledThemeSnapshot(packageId)` re-reads and re-verifies the installed `theme.json` before returning only the supported declarative Design values. For Component insert, `NSCodeHubV1.materializeInstalledComponentSnapshot(packageId)` re-reads and re-verifies both `component.json` and `component.html`, then returns one bounded non-script HTML fragment for site-local insertion.

Projection fields may include:

```text
packageId
type
title
version
authorLabel
source
category
tags
fileCount
integrityState
compatibility
preview capability
```

Private storage keys, raw account secrets and internal Workshop state are not part of the public contract.

---

## 18. Error contract

Failures must be user-comprehensible and machine-distinguishable.

Important error classes include:

- unsupported package format/schema;
- missing manifest;
- malformed/unsafe path;
- undeclared/missing file;
- size/hash/CRC mismatch;
- incompatible app version;
- unsupported package type;
- unsupported required capability;
- same-version conflict;
- invalid update;
- storage/commit failure.

The UI should show a human message while preserving an internal stable error code where practical.

---

## 19. Catalog/backend boundary

The package artifact remains backend-independent.

Account/database/object-storage choices do not change the local ZIP contract.

Public catalog data such as moderation state, verified publisher identity, download counts, ratings, prices/entitlements and server storage locations are catalog/account records, not authoritative ZIP fields.

A package downloaded outside the catalog can still be locally verified and installed as an unverified-source package.

---

## 20. Filtering/search contract

For Workspace 1.0 the minimum useful library filtering model is:

```text
source: official | installed
category: type-specific category
query: title/author/tags
```

This is enough to avoid a flat unmanageable list while not creating a large taxonomy system before release.

The catalog may later add richer filters without changing package identity or installation semantics.

---

## 21. Release gate

A package type is not release-complete because a card is visible.

For each enabled type, the real gate is:

```text
create/package
-> check real bytes
-> export
-> install/re-verify
-> durable installed registry
-> correct Web Studio destination
-> real preview where applicable
-> explicit use/materialization
-> restart persistence
-> conflict/update behavior
-> remove without resurrection or site-data loss
```

Only the portions actually exercised by real smoke tests may be marked PASS/FROZEN.
