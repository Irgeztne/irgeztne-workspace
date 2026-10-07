# IRGEZTNE Site Widget Contract v1

**Status:** Architecture Contract / FROZEN  
**Date:** 2026-09-08  
**Accepted revision:** Host Theme Context amendment 2026-09-08  
**Human architecture acceptance:** 2026-09-08  
**Scope:** Site Widget package type for IRGEZTNE Workshop ↔ Web Studio 1.0  
**Parent contract:** `docs/workshop/IRGEZTNE-WORKSHOP-WEB-STUDIO-CYCLE-CONTRACT-v1.md`  
**Parent status:** FROZEN FOUNDATION

---

## 1. Purpose

This document defines the Site Widget-specific contract beneath the frozen IRGEZTNE Workshop ↔ Web Studio Cycle Contract v1.

It does **not** replace or rewrite the parent contract. It narrows the behavior of package type:

```text
widget
```

The goal is to support safe, predictable and extensible website functionality from Workshop without treating a Widget as a Theme, Template, Component/Block, Workspace plugin, or arbitrary code injection mechanism.

The Widget contract must support both local/self-contained widgets and external/hosted integrations while preserving the Workshop Package Check boundary, Web Studio ownership of placement, and the rule:

```text
Installed != Configured != Placed != Site Instance
```

---

## 2. Core distinction: Widget is not a Block

A Component/Block is primarily structural/presentational page content.

Examples:

- Hero
- CTA
- FAQ
- Pricing
- Testimonials
- Contacts
- Footer

A Site Widget is primarily functional/interactive website behavior.

Examples:

- comments
- calculator
- map
- search
- booking interface
- media controller
- site chat
- ticker / market strip
- weather/data panel
- calendar
- form
- external service integration

A Widget may be visually large or small, but **visual size does not define the package type**.

A full-width market ticker remains a Widget because its primary role is functionality/data behavior.

A compact CTA remains a Block because its primary role is page structure/presentation.

---

## 3. Widget lifecycle

Canonical local lifecycle:

```text
Workshop Catalog / ZIP
        ↓
Package Check (Customs boundary)
        ↓
Installed Widget
        ↓
Configure
        ↓
Choose Placement
        ↓
Add to Site
        ↓
Site Widget Instance
        ↓
Preview / Open Site / Export / Publish
```

Downloading or installing a Widget must not change a site.

The Widget only enters a site after explicit configuration/placement and user confirmation.

### 3.1 Required state separation

These states are different:

```text
Downloaded
Installed
Configured draft
Placed / Site Instance
```

Do not collapse them into one action.

### 3.2 Installed != Site Instance

Removing an installed source package from Workshop must not silently delete an already created Site Widget Instance.

Updating an installed source package must not silently mutate an existing Site Widget Instance.

A user may explicitly choose an instance update/migration in a future contract, but this is not implicit behavior.

---

## 4. Responsibility boundaries

### 4.1 Widget author / webmaster

The author owns:

- Widget functionality;
- Widget internal HTML/CSS/JS where local runtime is used;
- supported placement modes;
- supported sizes/positions;
- Widget-specific settings schema;
- external service requirements;
- declared network origins;
- declared runtime capabilities;
- documentation and compatibility metadata;
- external management/dashboard flow where applicable.

The author does **not** describe Web Studio internals or template DOM selectors.

### 4.2 Workshop

Workshop owns:

- package discovery;
- package import/download;
- Package Check / Customs gate;
- manifest validation;
- integrity verification;
- capability/permission review;
- installed registry;
- public catalog/review state;
- future creator/commercial/entitlement layer.

Workshop is the trust and package lifecycle boundary.

### 4.3 Web Studio

Web Studio owns:

- site selection;
- configuration UI generated from the Widget contract;
- placement UI;
- normalized Host Surface creation;
- creation/removal of Site Widget Instances;
- site-local placement state;
- preview/open/export representation;
- safe runtime embedding according to the validated contract.

Web Studio must not guess undocumented Widget capabilities.

### 4.4 Site Widget Instance

A Site Widget Instance owns the concrete per-site state necessary to reproduce the integration, including:

- package identity/version provenance;
- runtime snapshot or normalized external integration descriptor;
- user-selected configuration;
- placement mode and placement state;
- public instance parameters;
- required non-secret external integration identifiers;
- instance-local state where supported.

---

## 5. Three independent axes

The Widget contract separates three concerns that must not be conflated:

```text
Runtime != Placement != Management
```

### Runtime

Where/how the Widget functionality executes.

### Placement

How the Widget occupies website space.

### Management

Where the user changes functional settings after installation.

Example:

A hosted chat can be:

```text
runtime: hosted
placement: floating
management: external
```

A local calculator can be:

```text
runtime: local
placement: flow
management: local
```

---

## 6. Runtime models

Widget Contract v1 recognizes these runtime classes.

### 6.1 `local`

The functional Widget runtime is bundled in the package.

Typical contents:

```text
widget.html
widget.css
widget.js
assets/
```

The runtime executes inside the website-scoped sandbox defined by Web Studio.

A local Widget does not receive Node.js, Electron or Workspace internal access.

### 6.2 `hosted`

The package describes a validated integration with a remote Widget/service.

The remote provider may own:

- application backend;
- chat messages;
- comments;
- bookings;
- external data;
- service dashboard;
- account-side configuration.

For v1, the preferred hosted integration is a bounded iframe/embed origin controlled by the validated contract.

### 6.3 `hybrid` — reserved capability

A future Widget may combine a local host/runtime shell with remote services.

This mode must not silently widen permissions. Every remote origin and capability remains declared and validated.

Hybrid support may remain disabled until explicitly implemented and reviewed.

---

## 7. Arbitrary script injection is not a Widget contract

The following is **not** an acceptable general v1 integration model:

```html
<script>
  // arbitrary third-party code pasted into the page
</script>
```

Workshop/Web Studio must not treat an arbitrary code snippet as trusted simply because it is labeled a Widget.

A future external script-loader capability, if required, is a separate higher-risk capability and must have:

- explicit declaration;
- restricted origins;
- stricter Package Check;
- explicit user disclosure;
- dedicated runtime policy.

It is disabled by default in Widget Contract v1.

---

## 8. Placement model

A Widget is not automatically inserted as another DOM child of the currently selected Component/Block.

Web Studio creates a normalized **Widget Host Surface** according to a supported placement mode.

Widget Contract v1 defines four placement families:

```text
flow
region
bar
floating
```

An author declares which modes are supported.

The user chooses among those supported modes before the Widget is added to the site.

---

## 9. `flow` placement

`flow` places a Widget in the normal page flow between semantic page sections/surfaces.

Typical use:

- calculator
- search panel
- calendar
- data panel
- form
- compact utility

Supported width classes may include:

```text
compact
medium
wide
full
```

Applicable alignment choices may include:

```text
left
center
right
stretch
```

The Widget author declares supported values.

Web Studio owns the actual CSS/layout implementation for the current template.

The Widget package must not prescribe selectors such as:

```text
.hero > div:nth-child(2)
```

---

## 10. `region` placement

`region` places a Widget in a semantic Host Slot exposed by Web Studio/template integration.

Canonical semantic slot vocabulary may include:

```text
page-top
after-header
main-start
main-end
before-footer
page-bottom
```

A template may internally use Grid, Flexbox or another layout system; the Widget must not know or depend on that internal structure.

If a requested semantic region is unavailable in a specific template, Web Studio must:

- show that the region is unavailable; or
- offer another supported placement mode;
- never silently inject the Widget into an unrelated DOM container.

---

## 11. `bar` placement

`bar` represents a horizontal functional strip.

Typical use:

- market prices/ticker;
- announcements;
- status bar;
- shipping/service banner;
- compact external-data stream.

Potential positions:

```text
page-top
after-header
before-footer
page-bottom
```

A bar is normally `full` width at the Host Surface level.

The Widget itself controls its internal visual composition, while Web Studio controls the external page geometry.

---

## 12. `floating` placement

`floating` is outside normal document flow.

Typical use:

- site chat;
- help button;
- floating assistant;
- compact action panel;
- notification control.

Supported positions may include:

```text
top-left
top-right
bottom-left
bottom-right
```

Web Studio owns viewport anchoring, collision margins and responsive constraints.

The Widget author declares supported floating positions and size classes.

The Widget must not achieve floating placement by injecting arbitrary global page CSS.

---

## 13. Host Surface ownership

This is a hard architectural rule:

> The external geometry belongs to Web Studio. The internal visual/functionality belongs to the Widget.

Web Studio Host Surface owns:

- page placement;
- outer width constraint;
- outer position;
- semantic region;
- responsive boundary;
- viewport anchoring for floating mode;
- host-level overflow policy;
- sandbox/container boundary.

The Widget owns inside its runtime:

- internal layout;
- internal colors/typography unless mapped through supported theme tokens;
- controls;
- data rendering;
- functional behavior.

This prevents a template CSS Grid/Flex rule from accidentally collapsing a Widget into an unrelated column.

---

## 14. Size contract

A Widget may declare supported semantic sizes rather than hardcoding knowledge of a specific template.

Example:

```text
sizes:
- compact
- medium
- wide
```

Optional bounded hints may include:

```text
minWidth
preferredWidth
maxWidth
minHeight
preferredHeight
maxHeight
heightMode
```

Allowed `heightMode` values for v1:

```text
fixed
content
```

Actual pixel limits remain subject to Workshop validation and Web Studio safety/responsive constraints.

A Widget must not require an unbounded page size.

---

## 15. Configuration before placement

The canonical user action for an installed Widget is not simply:

```text
Insert
```

It is:

```text
Add to Site
   ↓
Configure
   ↓
Placement
   ↓
Confirm
```

A Widget may skip a configuration page only if it truly has no configurable fields and has a deterministic safe default placement choice.

Even then, Web Studio must not silently place it into a random DOM location.

---

## 16. Widget settings schema

Widget-specific settings should be declarative where practical.

Web Studio should generate a consistent settings UI from supported field types.

Initial v1 field classes may include:

```text
text
textarea
number
boolean
select
multi-select
color
url
public-id
```

Future additions may include richer validated types.

The schema may define:

- label;
- description;
- required/optional;
- default;
- allowed values;
- numeric min/max;
- URL/origin constraints;
- localization keys;
- whether a field is public site configuration.

---

## 17. Settings ownership

Widget Contract v1 recognizes three management models:

```text
local
external
hybrid
```

### 17.1 `local`

Functional settings are managed in Web Studio.

### 17.2 `external`

The external provider owns functional management in its own dashboard/service.

Web Studio may only request the integration identifiers necessary to connect the site instance.

Example:

```text
Widget ID
Site ID
public channel ID
```

### 17.3 `hybrid`

Some settings are local and some are managed externally.

Example:

```text
Web Studio:
- placement
- size
- language

Provider dashboard:
- operators
- chat routing
- automation rules
- message history
```

---

## 18. Placement settings are not author business settings

The contract keeps these categories separate.

### Widget functional settings

Defined by the author/provider.

Examples:

- symbols/tickers;
- city;
- calendar source;
- form behavior;
- language;
- display options;
- public service/widget ID.

### Placement settings

Owned by Web Studio within the author's declared capabilities.

Examples:

- flow / region / bar / floating;
- semantic region;
- compact / medium / wide / full;
- left / center / right;
- bottom-right / bottom-left.

The author declares what is supported; Web Studio owns how those abstract choices map onto a particular site/template.

---

## 19. Manifest extension

The canonical manifest remains:

```text
irgeztne-package.json
```

A Widget extends the parent package metadata with a validated Widget descriptor.

Illustrative shape:

```json
{
  "type": "widget",
  "widget": {
    "contract": "1.0",
    "runtime": {
      "mode": "local"
    },
    "management": {
      "mode": "local"
    },
    "appearance": {
      "modes": ["inherit", "self-contained"],
      "preferredMode": "inherit"
    },
    "placement": {
      "modes": ["flow", "floating"],
      "preferredMode": "flow",
      "sizes": ["compact", "medium"],
      "align": ["left", "center", "right"],
      "floatingPositions": ["bottom-right"]
    },
    "settings": {
      "schema": "settings/widget-settings.json"
    }
  }
}
```

This is an architectural example, not a promise that these exact JSON key names are frozen before implementation review.

---

## 20. Runtime capability declaration

A local Widget must explicitly declare active capabilities.

Example conceptual profile:

```text
JavaScript: yes
Network: no
Local instance storage: yes
External links: yes
Workspace filesystem: no
Node.js: no
Electron: no
Workspace internals: no
Account secrets: no
Process execution: no
```

A hosted Widget may additionally declare:

```text
Hosted origin:
- https://widget.example.com

Network origins:
- https://api.example.com
```

Undeclared capability means denied.

---

## 21. Least privilege

A Widget receives only the capabilities required for its declared function.

Do not grant generic permissions such as:

```text
network: all
filesystem: all
scripts: unrestricted
```

when a bounded permission can be used.

Examples:

Prefer:

```text
origin: https://widget.example.com
```

over:

```text
internet: unrestricted
```

Prefer:

```text
storage: widget-instance-local
```

over:

```text
Workspace storage access
```

---

## 22. Secret handling

Static website output must not contain private provider secrets.

Widget Contract v1 must not place the following into exported public HTML/JS:

- private API keys;
- account passwords;
- Workspace account secrets;
- provider secret tokens;
- private signing credentials.

Hosted services intended for browser embedding should use public integration identifiers and provider-side authorization appropriate for public clients.

If a service requires a true secret to operate, that integration requires a server-side/proxy architecture outside the simple static Widget v1 model.

---

## 23. Sandbox boundary

Local active Widget code runs in a website-scoped sandbox.

It must not receive direct access to:

- Electron APIs;
- Node.js APIs;
- Workspace internal stores;
- arbitrary local filesystem;
- shell/process execution;
- account/provider credentials;
- other sites/projects unless explicitly mediated by a future API.

The sandbox must remain active in Editor preview and produced site representation where applicable.

---

## 24. Workshop Package Check / Customs profile

Every Widget must pass the parent Package Check plus Widget-specific validation.

Widget-specific checks include at minimum:

### Identity and structure

- valid `type: widget`;
- supported Widget contract version;
- stable package identity/version;
- valid runtime descriptor;
- valid management descriptor;
- valid appearance/Host Theme Context descriptor if declared;
- valid placement descriptor;
- valid settings schema if declared.

### Integrity

- package files match manifest;
- byte sizes match;
- SHA-256 hashes match;
- no undeclared files affecting runtime;
- no path traversal;
- bounded unpacked size/file count.

### Capability consistency

- declared network origins match runtime references where reasonably detectable;
- local Widget cannot request Workspace/Node/Electron access;
- hosted origin is explicitly declared;
- external dependencies are disclosed;
- unsupported high-risk capabilities fail validation.

### Placement consistency

- at least one supported placement mode;
- only known placement modes;
- size/position values are within contract vocabulary;
- no template-specific DOM selector placement;
- no arbitrary global page CSS requirement for placement.

### Appearance / Host Theme Context consistency

- only known appearance modes are declared;
- requested Host Theme Context tokens are from the supported bounded vocabulary;
- no raw Theme CSS or template selector dependency is required;
- hosted appearance transport obeys the declared hosted origin/capability rules;
- no secret/private Workspace state is requested as appearance context.

### Settings consistency

- schema field types are supported;
- required fields are valid;
- defaults satisfy constraints;
- secret-like fields are rejected from public site configuration;
- external URLs/origins obey declared capability rules.

---

## 25. Workshop review vs local validation

Two security/trust layers are different.

### Local Package Check

Mandatory for every imported Widget, including a manually imported ZIP.

It verifies technical contract/integrity rules.

### Public Workshop review

Applies to public catalog submission and may additionally evaluate:

- creator identity/reputation;
- misleading metadata;
- privacy disclosure;
- external service behavior;
- permission changes;
- suspicious origins;
- licensing/provenance;
- policy/legal requirements;
- elevated capability requests.

A package being paid, popular, or authored by a known creator does not bypass Package Check.

---

## 26. Update permission changes

A Widget update must not silently widen its permissions.

If a new version introduces meaningful new capability/origin requirements, Workshop should treat this as a permission change.

Future UX may require explicit user acknowledgement before update/activation.

Examples:

```text
1.0.0: Network = no
1.1.0: Network = api.example.com
```

or:

```text
1.0.0: runtime = local
2.0.0: runtime = hosted
```

These are not silent metadata changes.

---

## 27. Site Instance persistence

For a local Widget, the Site Widget Instance must retain enough validated runtime/configuration data to continue functioning after the installed source package is removed.

For a hosted Widget, the Site Widget Instance retains the validated integration descriptor and public configuration required to reconnect to the external service.

However, hosted service availability is inherently external.

Therefore:

```text
source package removal != site instance removal
```

but:

```text
external provider outage/removal may make a hosted integration unavailable
```

This dependency must be disclosed; it must not be falsely presented as fully self-contained/offline.

---

## 28. Site Instance editing

After insertion, a Widget instance should expose an instance inspector rather than generic Component structural controls.

Conceptual actions:

```text
Settings
Placement
Size / Position (where supported)
Open provider dashboard (where applicable)
Disable (future/optional)
Remove from site
```

Generic Block actions such as arbitrary block reordering are not automatically appropriate for every placement mode.

For example:

- `flow` may support order movement;
- `bar` changes semantic slot;
- `floating` changes viewport position;
- `region` changes semantic region.

---

## 29. Editor insertion UX

Canonical Widget flow in Web Studio:

```text
Site Widgets
    ↓
Choose installed Widget
    ↓
Widget details / capability summary
    ↓
Configure
    ↓
Choose supported placement
    ↓
Preview placement
    ↓
Add to Site
```

A contextual `Add Widget` entry may be offered from Editor, but it must not imply that every Widget is inserted "after this block".

If the current context is relevant, it can preselect a compatible `flow` or `region` candidate, but the user confirms placement before creation.

---

## 30. Semantic Host Slots

Templates/Web Studio should expose stable semantic placement zones rather than raw DOM selectors.

The Widget contract speaks in semantic slot names.

The template/host adapter maps those slots onto its actual DOM/layout.

This keeps a Widget independent from:

- template class names;
- nested wrappers;
- Grid column definitions;
- Flex order;
- generated editor internals.

A future template contract may explicitly declare available semantic slots.

---

## 31. Host Theme Context

A Widget must not assume it can read or mutate arbitrary Theme CSS, inspect template DOM, or inherit unrestricted page styles.

Widget Contract v1 therefore defines a bounded, read-only **Host Theme Context** owned by Web Studio. Its purpose is not to make every Widget visually identical to every template. Its purpose is to give a Widget enough normalized appearance context to integrate intentionally without coupling to template internals.

### 31.1 Initial bounded tokens

The initial v1 Host Theme Context may expose normalized tokens such as:

```text
colorScheme: light | dark
accentColor
textColor
mutedTextColor
surfaceColor
borderColor
radiusToken
fontFamilyToken
```

These values are host-provided presentation inputs, not access to the Theme implementation.

Web Studio must sanitize/normalize the values it exposes. A Widget must not receive arbitrary selectors, raw Theme stylesheets, unrestricted CSS strings, or access to computed styles elsewhere on the page.

### 31.2 Widget appearance modes

A Widget author may declare one or more supported appearance modes:

```text
inherit
variants
self-contained
```

`inherit` means the Widget is prepared to consume supported Host Theme Context tokens.

`variants` means the Widget provides bounded visual variants such as light/dark or another declared finite set; Web Studio may choose or suggest a compatible variant from the current Host Theme Context.

`self-contained` means the Widget deliberately keeps its own visual identity and does not require Host Theme Context beyond any mandatory accessibility/contrast constraints.

A Widget may support more than one mode, but it must declare what it supports. Web Studio must not assume that every Widget can inherit site appearance.

### 31.3 Transport boundary

The mechanism used to deliver Host Theme Context is owned by Web Studio and may differ by runtime mode.

For a local sandboxed Widget, Web Studio may provide normalized values through a controlled host-to-sandbox channel or injected bounded variables.

For a hosted Widget, theme context may be transmitted only through a validated public integration mechanism supported by the provider contract, such as bounded public parameters or an origin-checked message channel.

Host Theme Context must never contain private Workspace state, secrets, arbitrary page content, or unrestricted CSS/DOM access.

### 31.4 Responsibility boundary

The hard ownership rule remains:

> Web Studio owns external geometry and Host Theme Context. The Widget owns its internal visual composition and functionality.

Host Theme Context does not transfer responsibility for Widget quality to Web Studio. Widget authors remain responsible for responsive behavior, readable contrast, and correct rendering within declared Host Surface sizes.

Widget Contract v1 does not promise perfect automatic visual matching with every template. It does require that a Widget can state clearly whether it inherits host appearance, supplies finite variants, or remains self-contained.

---

## 32. Accessibility and responsiveness

Public Workshop validation should increasingly require Widget authors to support basic web usability.

Expected direction:

- keyboard-accessible controls;
- semantic labels where applicable;
- responsive behavior inside supported Host Surface sizes;
- no forced viewport overflow;
- bounded animation;
- readable focus states;
- no hidden critical interaction behind hover-only behavior.

Exact enforcement can grow over time without changing the package type.

---

## 33. External management links

An externally managed Widget may expose a provider dashboard URL as metadata.

Web Studio may present:

```text
Open Provider Dashboard
```

This is a navigation action, not a grant of Workspace privilege.

The provider dashboard must never receive Workspace secrets merely because the user opened the link.

---

## 34. Workshop / commercial layer compatibility

The parent contract already reserves:

```text
FREE
FREEMIUM
PAID / PRO
```

Widget Contract v1 must remain compatible with that future layer without embedding payment authority inside the Widget ZIP.

Commercial state belongs to Workshop Catalog / Account entitlement.

A future author may offer:

- free Widget;
- freemium Widget;
- Pro Widget;
- Pro capabilities/settings.

But:

```text
payment != trust
entitlement != Package Check
```

A paid Widget passes the same Customs/Package Check boundary.

---

## 35. Entitlement separation

Future commercial implementation must keep these concepts separate:

```text
Package
Entitlement
Site Instance
```

Workshop/Account decides whether the user may install/use a commercial capability.

Web Studio receives an entitlement result; it does not implement billing.

The technical package format remains compatible with the parent contract's commercial-layer separation.

Detailed expiry/subscription/offline rules are post-1.0 and must not be invented prematurely.

---

## 36. What Widget Contract v1 deliberately does not permit

Do not include in the initial Widget 1.0 implementation:

- Workspace plugins;
- Node.js extensions;
- Electron extensions;
- native executable code;
- arbitrary shell/process execution;
- arbitrary filesystem access;
- unrestricted external script injection;
- secret credentials embedded into static site output;
- direct access to global Workspace account data;
- template-specific DOM-selector placement;
- automatic mutation of a site immediately after Workshop install;
- automatic silent permission widening during updates.

---

## 37. Minimum v1 implementation profile

To avoid overbuilding before Workspace 1.0, the first implementation may support a bounded subset while retaining the full contract shape.

Recommended first implementation:

```text
Runtime:
- local
- hosted iframe

Placement:
- flow
- region
- bar
- floating

Management:
- local
- external
- hybrid metadata where practical

Settings:
- basic declarative fields

Appearance / Host Theme Context:
- bounded read-only tokens
- inherit / variants / self-contained declaration
- no raw Theme CSS or DOM access

Security:
- strict sandbox
- declared origins
- no arbitrary script-loader
- no secrets
```

Unsupported capabilities must fail cleanly rather than be approximated with unsafe workarounds.

---

## 38. Required real lifecycle smoke

A Widget adapter is not REAL PASS solely because automated tests pass.

At least one local test Widget must prove:

```text
install
→ configure
→ choose placement
→ add to site
→ interact in Editor
→ interact in Preview/Open Site
→ restart Workspace
→ instance survives
→ uninstall source Widget
→ restart Workspace
→ local instance survives and still functions
```

At least one hosted integration test should later prove:

```text
install
→ disclose external origin
→ configure public integration ID
→ place
→ preview/open site
→ external runtime loads only from allowed origin
→ uninstall source package
→ site instance retains integration descriptor
```

Hosted service availability itself is not under Workspace control.

---

## 39. Current R1W9G finding

The first R1W9G Counter experiment proved useful runtime behavior but also exposed an incorrect placement assumption.

Confirmed useful evidence:

- Widget package can be installed through Workshop;
- functional JavaScript can run in a sandboxed site Widget;
- the Counter interaction works in site preview/opened site;
- Widget is meaningfully different from a static Component.

Rejected assumption:

```text
Widget = Component-like iframe inserted after selected DOM block
```

This assumption caused template Grid/Flex behavior to distort Widget geometry and did not model compact, bar, region or floating Widgets correctly.

Therefore R1W9G must be reconciled against this placement contract before Widget adapter REAL PASS.

Do not keep stacking visual CSS patches onto the old placement assumption.

---

## 40. Frozen-parent compatibility rules

This child contract preserves the following parent principles unchanged:

1. Workshop is for website packages, not Workspace internal modules.
2. Site Widget is one of the allowed website package types.
3. `irgeztne-package.json` remains the canonical package manifest.
4. Package Check / Проверка пакета is the public validation name; “Customs / Таможня” remains an internal nickname.
5. Installation re-verifies package contents and integrity.
6. Widget code does not gain Workspace/Node/Electron privileges.
7. External dependencies are disclosed.
8. Installed-package registry remains the Workshop ↔ Web Studio bridge.
9. Public submission is stricter than local Package Check.
10. Commercial state remains outside the ZIP technical authority.
11. Backend provider choice remains implementation detail.

---

## 41. Widget Contract 1.0 invariants

These are the accepted central invariants that implementation must preserve:

1. **Widget is functionality, not merely another page Block.**
2. **Workshop install never places a Widget onto a site.**
3. **Configure and Placement occur before creation of the Site Widget Instance.**
4. **Runtime, Placement and Management are independent axes.**
5. **Web Studio owns Host Surface geometry.**
6. **Widget owns its internal visual/functionality.**
7. **Widget never targets template DOM internals/selectors.**
8. **Semantic Host Slots are the bridge to different templates.**
9. **All capabilities are declared; undeclared capability is denied.**
10. **Local code is sandboxed and website-scoped.**
11. **Hosted integrations disclose and restrict external origins.**
12. **Arbitrary third-party script injection is not enabled by default.**
13. **No private secrets are embedded into exported static site output.**
14. **Installed != Site Instance.**
15. **Removing source package does not silently remove an existing instance.**
16. **Paid/Pro status never bypasses Package Check.**
17. **Host Theme Context is bounded and read-only; it never grants arbitrary Theme CSS/DOM access.**
18. **Real user lifecycle smoke is required before the Widget adapter may be labeled REAL PASS / FROZEN.**

---

## 42. Required implementation reconciliation

Do not continue polishing the current Counter's accidental placement.

With this contract accepted and frozen:

```text
1. Reconcile current R1W9G implementation with Widget Contract v1.
2. Add a Widget configuration step before placement.
3. Add normalized Host Surface abstraction.
4. Add bounded read-only Host Theme Context and declared appearance modes.
5. Implement semantic placement modes without raw template DOM coupling.
6. Keep sandbox/capability validation under Workshop Package Check.
7. Reuse the Counter only as a functional test artifact.
8. Run a real Widget lifecycle smoke.
9. Freeze Widget adapter only after human PASS.
```

Do not start public marketplace/commercial implementation as part of this pass.

---

## 43. Status gate

This document is now:

```text
FROZEN
```

Human architecture review accepted the runtime, placement, management, Host Theme Context/appearance, security and lifecycle boundaries on 2026-09-08.

The contract must not be reopened merely to preserve the first experimental R1W9G placement behavior. Implementation must be reconciled to this contract. Any future contract change requires explicit architectural review and version/revision discipline.

---

**END OF IRGEZTNE SITE WIDGET CONTRACT v1 — FROZEN**
