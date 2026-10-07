# IRGEZTNE Workshop ↔ Web Studio Cycle Contract v1

**Status:** Architecture Contract / FROZEN FOUNDATION  
**Date:** 2026-09-01  
**Scope:** IRGEZTNE Workspace 1.0 foundation for Workshop and Web Studio package ecosystem

---

## 1. Purpose

IRGEZTNE Workshop is the catalog, installation and authoring hub for **website-related packages used by IRGEZTNE Web Studio**.

Workshop is not a marketplace for internal Workspace system modules.

The core product loop is:

```text
Create → Check → Publish/Export → Discover → Install → Use in Web Studio → Update
```

The contract must allow the public catalog, creator ecosystem and future commercial layer to grow without rebuilding the package format or Web Studio integration.

---

## 2. Hard boundary: Website packages vs Workspace internals

Workshop v1 handles only content and extensions intended for websites created in Web Studio.

Included:

- Templates
- Themes
- Components / Blocks
- Site Widgets

Not included:

- Workspace Information-panel modules
- Workspace Weather
- Workspace Economy
- internal Workspace tools
- Electron extensions
- Node.js plugins
- arbitrary Workspace plugins

Weather, Economy and other Information-panel modules remain built-in Workspace functionality.

A future Workspace Plugin / Extension API, if ever introduced, is a separate architecture and security class and is not part of this contract.

---

## 3. Package types

### 3.1 Template

A complete or substantial website starting point.

Typical structure:

```text
index.html
css/
js/
images/
assets/
```

Install target:

```text
Web Studio → Templates → Installed
```

### 3.2 Theme

A visual-design package: styles, typography, tokens, theme assets and compatible presentation rules.

Install target:

```text
Web Studio → Design / Themes
```

### 3.3 Component / Block

A reusable site section or interface unit.

Examples:

- Hero
- Pricing
- FAQ
- Gallery
- Header
- Footer
- Contact block

Install target:

```text
Web Studio Editor → Components / Blocks
```

### 3.4 Site Widget

A functional element intended to run **inside a website**.

Examples:

- comments
- calculator
- map
- form
- search
- booking interface
- media widget
- timer
- site chat
- external-data widget

Install target:

```text
Web Studio Editor → Site Widgets
```

A Site Widget is not an Information-panel widget of Workspace.

### 3.5 Plugins

Not enabled for Workshop 1.0.

A real plugin system for Workspace/Web Studio internals requires a separate Extension API and stronger security model.

---

## 4. Workshop primary navigation

Workshop should have three main user-facing areas:

```text
[ Catalog ]   [ Installed ]   [ My Packages ]
```

### Catalog

For users discovering packages.

Contains:

- categories
- package cards
- search/filtering
- package details
- author
- version
- compatibility
- license
- FREE / FREEMIUM / future PAID status
- cover/gallery
- install/download actions

### Installed

Local registry of packages installed into Workspace.

Contains:

- installed version
- package type
- author
- target inside Web Studio
- update availability
- remove/uninstall
- package details
- integrity state

### My Packages

Author/webmaster workspace.

Contains the package builder already being developed:

- Details
- Files
- Preview
- Compatibility
- Package Check
- ZIP export
- future Submit to Workshop

`New Package` belongs primarily inside **My Packages**, not as the dominant action for every Workshop visitor.

---

## 5. Author flow

Canonical author flow:

```text
Web Studio
    ↓
Create template/theme/component/site-widget
    ↓
Workshop → My Packages
    ↓
Add project folder/files
    ↓
Add metadata
    ↓
Add cover/gallery
    ↓
Live Preview
    ↓
Package Check
    ↓
Ready to Publish
    ↓
Export ZIP
    or
Submit to Workshop
    ↓
Server review/publication
    ↓
Public Catalog
```

Local package creation and ZIP export do not require an account.

Submitting to the public Workshop requires IRGEZTNE Account.

---

## 6. User flow

Canonical user flow:

```text
Workshop → Catalog
        ↓
Package card
        ↓
Package details
        ↓
Install in Workspace
        ↓
Local package verification
        ↓
Installed registry
        ↓
Correct Web Studio destination
        ↓
Use in site
```

Free packages may also offer:

```text
Download ZIP
```

A downloaded ZIP can later be imported into Workspace and must pass the same local verification.

---

## 7. Web Studio landing rules

After installation, the package must appear where the user naturally expects to use it.

| Package type | Web Studio destination |
|---|---|
| Template | Templates → Installed |
| Theme | Design / Themes |
| Component / Block | Editor → Components / Blocks |
| Site Widget | Editor → Site Widgets |

Web Studio may include contextual links such as:

```text
Find more in Workshop
```

These links should open Workshop directly in the corresponding catalog category.

Workshop manages discovery/install/update/removal.

Web Studio manages actual use of installed website packages.

---

## 8. Folder and file structure

Workshop must support complete project-folder import.

Required behavior:

- Add individual files.
- Add a complete folder.
- Preserve relative paths.
- Preserve nested directories.
- Calculate SHA-256 for every stored file.
- Store real bytes locally.
- Reproduce the same directory structure in exported ZIP.
- Never flatten `css/`, `js/`, `images/`, or other valid directories.

Example:

```text
my-template/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── main.js
└── images/
    └── hero.jpg
```

The resulting package and ZIP must preserve:

```text
index.html
css/style.css
js/main.js
images/hero.jpg
```

---

## 9. Package presentation vs website assets

Website assets and Workshop presentation assets are separate concepts.

### Website files

Used by the actual template/widget/component:

```text
images/hero.jpg
css/style.css
js/main.js
```

### Workshop presentation

Used to present the package in Workshop:

```text
cover
gallery screenshots
optional demo metadata
```

The Preview area should make this distinction clear.

---

## 10. Live Preview

Templates and other previewable website packages must have a real local preview.

For templates:

```text
index.html + CSS + JS + assets
        ↓
isolated local preview
```

Live Preview is different from cover/gallery.

The preview must be sandboxed from Workspace internals.

Website package code must not receive direct access to:

- Electron APIs
- Node.js APIs
- Workspace internal stores
- local filesystem outside its allowed package context
- account secrets
- provider credentials

---

## 11. Package identity

Every publishable package needs stable identity.

Minimum canonical metadata:

```text
package_id
creator_id
type
name
version
license
distribution
workspace_compatibility
entrypoint / role metadata
files
hashes
preview metadata
capabilities / permissions
```

`package_id` remains stable across versions.

`version` follows SemVer where appropriate.

A new package release is a new version, not a silent overwrite of an existing published version.

---

## 12. Manifest

The canonical package manifest remains:

```text
irgeztne-package.json
```

It is generated from actual package state.

It must include enough information to validate:

- identity
- package type
- version
- author/creator
- license
- compatibility
- distribution mode
- entrypoints/roles
- file paths
- byte sizes
- SHA-256 hashes
- preview references
- declared capabilities where relevant

The manifest does not make a package trusted by itself.

Workspace must verify the actual package contents against the manifest.

---

## 13. Package Check

User-facing name:

**Package Check / Проверка пакета**

Internal nicknames such as “Customs / Таможня” must not appear in public UI.

Required checks include:

- required metadata
- valid version
- author
- package license
- supported package type
- allowed paths
- duplicate paths
- main/entry file where required
- actual file presence
- actual byte size
- SHA-256 integrity
- dangerous executable attachments
- unsupported file classes
- preview references
- compatibility fields
- path traversal attempts
- malformed ZIP structure
- reasonable file count
- reasonable total/unpacked size

Missing data is an explicit missing/error state, never fabricated.

---

## 14. Type-aware validation

Validation depends on package type.

### Template

Must have a valid main page/entrypoint, normally an HTML entry.

Should detect missing referenced local resources where reasonably possible.

Example:

```html
<link rel="stylesheet" href="css/style.css">
```

If `css/style.css` is absent, Package Check should report it.

### Theme

Must contain the theme resources and metadata required by the Web Studio theme contract.

### Component / Block

Must contain a valid component/block entry structure recognized by Web Studio.

### Site Widget

May contain JavaScript, but must declare required capabilities and external network use.

---

## 15. Capabilities and permissions

Site Widgets may be powerful but must remain website-scoped.

Examples of declared capabilities:

```text
JavaScript: yes
Network: yes
External domains:
- api.example.com

Workspace filesystem: no
Node.js: no
Electron APIs: no
Workspace internal data: no
Account secrets: no
```

A package must not gain broader Workspace privileges simply because it was installed from Workshop.

Network-capable widgets should declare external origins/services where practical.

The user should be able to understand meaningful capabilities before installation.

---

## 16. External dependencies

Workshop should distinguish:

- self-contained local assets
- external CDN assets
- remote APIs
- remote fonts/images/scripts

If a package depends on external resources, the Package Check/detail page should disclose that dependency.

A package must not appear fully offline/self-contained when essential parts require network access.

---

## 17. Installation verification

Installation is never “trust the ZIP”.

Canonical installation flow:

```text
ZIP / downloaded package
        ↓
read manifest
        ↓
validate paths and limits
        ↓
verify every stored file
        ↓
verify byte sizes
        ↓
verify SHA-256
        ↓
validate package type/compatibility
        ↓
install
```

A package with a failed integrity/security check is not installed.

---

## 18. Installed package registry

Workspace maintains a local installed-package registry.

Minimum state:

```text
package_id
installed_version
type
creator
install_target
installed_at
integrity_state
source
```

The registry is the bridge between Workshop and Web Studio.

---

## 19. Version conflicts and updates

If the same `package_id + version` is already installed, Workspace must not silently overwrite it.

Allowed UX:

```text
Already installed
Replace
Install as copy (only where safe/meaningful)
Cancel
```

If a newer version exists:

```text
Installed: 1.0.0
Available: 1.1.0
Update
```

Published versions should be treated as immutable artifacts.

Corrections are normally released as a new version.

---

## 20. Removal

Installed packages must be removable through Workshop → Installed.

Removal must not silently destroy user site content already created from a package.

For example, removing a template from the library must not delete an existing site that was previously created from that template.

The exact dependency behavior for live-linked components/widgets may be defined per package type.

---

## 21. Account boundary

IRGEZTNE Account is the single global identity owner.

No duplicate Workshop account surface.

Without account:

- create local package
- edit package
- Package Check
- Live Preview
- export ZIP
- import/install local ZIP
- use installed package locally

With account:

- creator identity
- public creator profile
- submit package
- manage published packages
- future sync
- future purchases/entitlements
- future commercial creator functions

---

## 22. Creator model

One IRGEZTNE Account maps to one persistent Creator identity/profile.

Public creator profile may include:

- display name / studio name
- avatar/logo
- description
- website/portfolio
- specialization
- published packages
- portfolio works

Package cards link to the creator profile.

Creator identity is server-backed when public publishing is enabled.

Local draft author metadata must not pretend to be a verified public identity.

---

## 23. Distribution modes

Package distribution supports:

```text
FREE
FREEMIUM
PAID / PRO   — reserved for future activation
```

For Workspace 1.0:

- FREE is supported.
- FREEMIUM may be represented.
- PAID/PRO remains disabled unless the commercial/legal/payment layer is ready.

---

## 24. Commercial layer separation

Commercial logic must not require a new package format.

The ZIP/package remains the same technical artifact.

Commercial state belongs to the Workshop catalog/account layer.

Future commercial data may include:

```text
price
currency
sale status
creator payout
platform commission
purchase record
refund state
entitlement
tax/VAT handling
```

These are not authoritative fields inside the ZIP.

Canonical future paid flow:

```text
Catalog
   ↓
Paid package
   ↓
Purchase
   ↓
Account entitlement
   ↓
Install
   ↓
local verification
   ↓
Web Studio
```

This allows commerce to be activated later without rebuilding package creation, checking, installation or Web Studio landing.

---

## 25. Licenses

The license field belongs to the individual package.

It is separate from the license of IRGEZTNE Workspace itself.

Supported examples can include:

- MPL-2.0
- MIT
- Apache-2.0
- GPL-3.0-or-later
- Proprietary
- Other

The package must not claim a license that is inconsistent with bundled third-party content.

Rights/provenance checks may become stricter for public submissions.

---

## 26. Local lifecycle

Local package lifecycle:

```text
Draft
  ↓
Checked
  ↓
Ready to Publish
```

A package may return to Draft/unchecked state when material changes invalidate a previous check.

---

## 27. Public lifecycle

Future public lifecycle:

```text
Submitted
   ↓
Under Review
   ↓
Published
```

Alternative states:

```text
Rejected
Archived
Update Required
```

A local PASS does not automatically mean public publication.

Executable/active site widgets may require stricter review than static templates/themes.

---

## 28. Public Workshop

Public Workshop is browsable without requiring an account.

Conceptual route:

```text
irgeztne.com/workshop
```

Public package pages may show:

- cover
- gallery
- package description
- author
- type
- version
- compatibility
- license
- distribution mode
- capabilities/external dependencies
- changelog
- Install in Workspace
- Download ZIP where permitted
- creator profile link
- external creator website where provided

Account should not be required merely to discover packages or inspect creator pages.

---

## 29. Public → Desktop install bridge

Long-term target:

```text
Public Workshop
        ↓
Install in Workspace
        ↓
IRGEZTNE Workspace opens/imports package
        ↓
local Package Check
        ↓
Installed
        ↓
Web Studio destination
```

If direct app handoff is unavailable, ZIP download/import remains a valid fallback.

---

## 30. Storage/backend independence

The package and Web Studio contracts must not depend on one specific cloud vendor.

Current deployment direction may use services such as:

- account/auth + database
- object storage for ZIPs/previews

But provider choice is implementation detail.

Changing backend provider must not require changing:

- package format
- local Package Check
- installed registry
- Web Studio destinations
- public package semantics

---

## 31. What is deliberately NOT part of Workshop 1.0 foundation

Do not block the local Workshop/Web Studio cycle on:

- payments
- creator payouts
- taxes/VAT
- ratings
- comments/reviews
- recommendation algorithms
- advertising
- internal Workspace plugins
- arbitrary native code
- automatic executable plugin activation
- full creator analytics
- enterprise licensing
- real-time collaboration

The architecture reserves room for these without requiring them now.

---

## 32. Release-complete local cycle

The local Workshop foundation is considered complete when this entire flow passes:

```text
Create a real Web Studio package/folder
        ↓
preserve folder structure
        ↓
add metadata
        ↓
add cover/gallery
        ↓
open Live Preview
        ↓
Package Check PASS
        ↓
export real ZIP
        ↓
import/install ZIP
        ↓
repeat integrity/security verification
        ↓
Installed registry
        ↓
package appears in correct Web Studio location
        ↓
use package in a site
```

This is the minimum closed loop for Workshop 1.0.

---

## 33. Frozen architectural principles

1. Workshop is for **website packages**, not built-in Workspace modules.
2. Package types for v1 are **Template, Theme, Component/Block, Site Widget**.
3. Workshop top-level user modes are **Catalog, Installed, My Packages**.
4. Local authoring works without account.
5. Public publishing/creator identity uses the global IRGEZTNE Account.
6. Package files are real bytes with SHA-256 verification.
7. Folder structure is preserved.
8. Cover/gallery is separate from website assets.
9. Preview is real and sandboxed.
10. Installation always re-verifies the package.
11. Stable package IDs and versions prevent silent overwrite.
12. Installed packages land in the correct Web Studio surface.
13. Site widgets may use web capabilities but do not gain Workspace/Node/Electron privileges.
14. Commercial logic is a catalog/account layer, not a new ZIP format.
15. FREE/FREEMIUM can exist before PAID.
16. Public catalog and creator pages are discoverable without mandatory login.
17. Built-in Information-panel Weather/Economy remain outside Workshop.
18. Future Workspace plugins require a separate architecture.
19. Backend providers are replaceable implementation details.
20. The closed loop is: **Create → Check → Publish/Export → Discover → Install → Use → Update**.

---

## 34. Next implementation milestone

Do not redesign the package builder again.

Implement the missing pieces against this contract in this order:

```text
1. Folder import + preserved relative paths
2. Live sandboxed template preview
3. Catalog / Installed / My Packages shell
4. ZIP import + installation verification
5. Installed-package registry
6. Web Studio destination adapters
7. Update/conflict/remove behavior
8. Public submission/backend integration
9. Commercial layer later
```

After steps 1–7 pass locally, the Workshop ↔ Web Studio local cycle can be frozen for Workspace 1.0.
