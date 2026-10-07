# IRGEZTNE Web Studio Template Contract v1

Status: **public local specialization / release-candidate**  
Owner boundary: **Workshop package -> Web Studio template adapter**  
Base contract: `docs/workshop/IRGEZTNE-WEB-STUDIO-PACKAGE-CONTRACT-v1.md`

## 1. Purpose

A template author must not know Web Studio private storage, renderer internals, site-manager state, or Electron APIs. The author targets the public Base Package Contract plus this Template specialization. Workshop validates and installs the package; Web Studio consumes it only through the public `NSCodeHubV1` adapter.

## 2. Transport container

A template is a ZIP with `irgeztne-package.json` at the ZIP root.

Required manifest envelope:

- `format`: `irgeztne-workshop-package`
- `formatVersion`: `1.0`
- `package.type`: `template`
- `package.id`: stable package id
- `package.title`: non-empty title
- `package.version`: semantic `x.y.z`
- `package.author.name`: creator label
- `package.license`: non-empty license id/name
- `package.distribution`: `free` or `freemium` for Workshop 1.0
- `package.compatibility.product`: `webstudio`
- `package.compatibility.minAppVersion`: semantic `x.y.z`
- `files`: complete list of package files

Backward-compatible discovery fields:

- `package.category`: optional locally; missing means `uncategorized`
- `package.tags`: optional free tags

Workshop exports the envelope from actual package state. Authors should not hand-edit Workspace private state.

## 3. File contract

Every non-manifest ZIP file must have exactly one `files[]` entry with:

- `path`: relative safe path using `/`
- `role`: `main`, `style`, `cover`, or `asset` (other non-executable asset roles may be preserved)
- `kind`: `document`, `stylesheet`, `image`, or `asset`
- `size`: exact byte length
- `mime`: MIME type
- `sha256`: lowercase SHA-256 of exact file bytes

A template must contain a main HTML document (`role: main`/`template`, or a valid `index.html`). Local references from HTML/CSS must resolve to declared package files. Workshop 1.0 rejects unsafe paths, undeclared files, executables/installers, size violations, CRC failures, and SHA-256 mismatches.

## 4. Preview contract

Installed template previews are built from verified local bytes. CSS, JavaScript and local images may run/render inside a sandboxed iframe. Network access, Node.js, Electron APIs, Workspace data, top navigation, objects and forms leaving the sandbox are blocked by the injected CSP/sandbox boundary.

Preview is a real action. A passive screenshot/card alone does not satisfy the preview contract.

## 5. Ownership boundary

Workshop owns:

- package validation and install/uninstall lifecycle;
- installed registry and verified local bytes;
- package metadata and integrity.

Web Studio owns:

- presentation of installed templates in the Templates library;
- filtering/search projection for installed templates;
- the adapter that creates a Web Studio site instance from a compatible installed template.

Web Studio MUST NOT read Workshop localStorage or IndexedDB directly. It uses the public `NSCodeHubV1` adapter only.

## 6. Adapter API v1A

The local bridge exposes discovery/preview methods:

- `NSCodeHubV1.getInstalledTemplates()`
- `NSCodeHubV1.getInstalledTemplatePreviewSrcdoc(packageId)`

R1W9D adds the explicit materialization handoff:

- `NSCodeHubV1.materializeInstalledTemplateSnapshot(packageId)`

The returned materialization payload is re-verified against the installed manifest (size + SHA-256) before handoff. Web Studio copies those bytes into its own site-local snapshot store. It does not keep a live link to Workshop storage. The returned catalogue is a safe metadata projection, not the private registry object.

## 7. Installed vs used

Installing a template places it in `Web Studio -> Templates -> Installed`.

It does not modify an existing site.

The v1 use action is conceptually:

```text
Create site from template
```

The resulting site becomes a site-local materialized instance/snapshot. Removing or updating the installed template later must not silently destroy or rewrite that site.

## 8. Identity, source and trust

Template title and author label are presentation metadata. The package id is stable identity.

A local author label is not a verified public publisher identity. Public publisher verification belongs to the Account/catalog layer.

SHA-256 integrity does not by itself prove authorship.

## 9. Current release boundary

R1W9A proved **installation -> Web Studio Templates visibility**. R1W9C/R1W9C1/R1W9C2 then received a real user smoke PASS for the interactive installed-template preview.

R1W9D is **REAL PASS / FROZEN** for: **installed template -> explicit Choose Template -> site-local Web Studio snapshot -> preview/open/ZIP from that snapshot**. Real user smoke proved creation, restart durability, source-package uninstall independence, a second restart, working local preview, external browser open and ZIP export after the installed source package was removed. The site-local copy is stored by Web Studio in a separate IndexedDB boundary.

The candidate gate was intentionally stated as: **R1W9D is not a real PASS until user smoke proves creation, restart durability and source-package removal independence.** That required smoke has now been completed successfully; the sentence is retained here as the historical acceptance condition, not as current pending status.

Arbitrary HTML/CSS/JS is still not claimed as converted into Web Studio's structured editable block/page model. R1W9D exposes that limitation instead of simulating editability.

R1W9D also does not claim Backup Center portability for the detached snapshot byte store yet. Restart durability and independence from Workshop uninstall are part of this gate; backup/restore integration is a separate persistence gate.

## 10. Update/removal rule

Installed and applied are separate states.

Installing or updating a template must never silently rewrite an existing website. Same-version reinstall is a conflict unless a future explicit repair action exists. A validated update must commit atomically; failure leaves the previously installed valid release intact.

Removing the installed template removes the library copy, not sites already created from it.
