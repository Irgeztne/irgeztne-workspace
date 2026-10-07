# IRGEZTNE Web Studio Component / Block Contract v1

Status: **public local specialization / R1W9F + R1W9F2 candidate**  
Owner boundary: **Workshop package -> Web Studio Editor component library adapter**  
Base contract: `docs/workshop/IRGEZTNE-WEB-STUDIO-PACKAGE-CONTRACT-v1.md`

## 1. Purpose

A Component / Block package supplies exactly **one reusable page block**.

Examples include a Hero section, CTA, FAQ, pricing section, testimonial group, footer section, contact block, team block, or another bounded piece of page content.

The v1 action is:

```text
Install Component -> Web Studio / Editor -> Installed components / blocks -> Insert block
```

Installing is not inserting.

One package is one component definition. A future bundle/collection may install several independent component packages, but bundle semantics are not part of Component v1.

## 2. Transport

A Component uses the normal Workshop ZIP envelope with `irgeztne-package.json` at the root.

Required package fields follow the Base Package Contract, with:

- `package.type`: `component`
- compatible product: `webstudio`
- semantic package version
- complete declared file list with sizes and SHA-256

Component v1 contains exactly these package files:

- `component.json`
- `component.html`

No JavaScript, separate CSS, images, fonts, or other package assets are enabled by this first bounded profile.

## 3. `component.json`

`component.json` MUST be at the ZIP root and its manifest entry MUST use:

- `role`: `main`
- `kind`: `data`
- `mime`: `application/json`

Format:

```json
{
  "format": "irgeztne-webstudio-component",
  "formatVersion": "1.0",
  "component": {
    "entry": "component.html",
    "category": "cta"
  }
}
```

`entry` is fixed to root `component.html` in v1.

`category` is a short lowercase token used for library filtering, for example:

`hero`, `cta`, `faq`, `pricing`, `footer`, `contact`, `team`, `gallery`, `content`.

## 4. `component.html`

`component.html` MUST be at the ZIP root and its manifest entry MUST use:

- `role`: `component`
- `kind`: `html`
- `mime`: `text/html`

It is an HTML fragment, not a complete document.

Component v1 is deliberately non-executable. The fragment MUST NOT contain:

- `script`
- `style`
- `iframe`
- `object`
- `embed`
- `link`
- `meta`
- `form`
- event-handler attributes such as `onclick`
- `javascript:` URLs
- `srcdoc`

Inline style attributes are allowed in this first profile so a small visual block can remain self-contained when copied into a page. Web Studio sanitizes the fragment again before insertion.

Interactive behavior belongs to the separate **Site Widget** type, not Component / Block.

## 5. Workshop ownership and public adapter

Workshop owns ZIP validation, installation, installed bytes and uninstall lifecycle.

Web Studio consumes installed Components only through the public `NSCodeHubV1` boundary:

- `NSCodeHubV1.getInstalledComponents()` for discovery metadata;
- `NSCodeHubV1.materializeInstalledComponentSnapshot(packageId)` for insertion.

The insert materializer re-reads the installed `component.json` and `component.html`, re-checks exact size and SHA-256 for both files, re-validates the component profile and returns a bounded handoff.

Web Studio does not read Workshop private localStorage or IndexedDB directly.

## 6. Installed is not inserted

Installing a Component only makes it visible in the Editor's installed component/block library.

Insertion is an explicit user action.

R1W9F2 adds bounded insertion-position semantics: the user may click/caret inside a structured Editor block before opening the Blocks library. The inserted Component is placed **after that selected structural page block**. If no explicit page position was chosen, insertion falls back to the end of the page. This avoids mandatory drag-and-drop while keeping placement under user control.

On insert, Web Studio copies the sanitized HTML fragment into the current page's ordinary site-local `bodyHtml` and records provenance metadata for the inserted instance. The one-shot insertion marker used by the Editor is never persisted as page content.

The inserted page does not keep a live dependency on the installed package.

Consequences:

- the same installed Component may be inserted into several pages or several times;
- uninstalling the source Component later does not remove already inserted instances;
- updating the installed Component does not silently rewrite existing pages;
- the inserted HTML can be edited as page content after insertion;
- deleting an inserted instance is a page-editing action, not a Workshop uninstall action.

## 7. Structured-site boundary

Component v1 inserts only into structured Web Studio pages.

A detached HTML/CSS/JavaScript site snapshot created from a Workshop Template is intentionally not converted into the structured Editor model. Component insertion is disabled for that site class rather than pretending the snapshot is editable.

## 8. Security and future expansion

This first profile intentionally does not support arbitrary JavaScript, external runtime capabilities, package-level CSS files, binary assets, dependencies, or background behavior.

Those may be added only through explicit later profiles.

A functional interactive element should use the separate Widget contract with its own capability/security gate.

## 9. Current release gate

R1W9F is an implementation candidate until real user smoke proves:

1. a valid Component ZIP installs;
2. it appears in `Web Studio -> Editor -> Installed components / blocks`;
3. `Insert block` adds the real block to a structured page at the user-selected block boundary (or at the end when no position is selected);
4. preview shows the inserted block in that position;
5. restart preserves the inserted block;
6. uninstalling the source Component and restarting again leaves the inserted page unchanged.

No R1W9F REAL PASS is claimed before that smoke.

### Real-smoke result — 08.09.2026

The required smoke has now passed with real user evidence:

- inserted Component instances survived Workspace restart;
- structural Delete -> Undo -> Redo restored and removed the real instance correctly;
- text Undo was also verified in the hardened Editor;
- the installed source `IRGEZTNE Test CTA Block` was uninstalled from Workshop;
- after another Workspace restart the already inserted Component instances remained on the page.

**R1W9F Component adapter = REAL PASS / FROZEN.**


## Editor integration hardening — R1W9F6

The Web Studio editor treats a Component / Block as a structural page block, not as a text-caret operation.

- The page content remains continuously visible while editing.
- Text editing and Component placement are separate interaction domains.
- A non-collapsed text selection may reveal contextual text-formatting tools; a normal caret does not summon a permanent toolbar.
- Structural actions are attached to the selected structural page block through an editor-owned `⋮` menu that is not persisted into `bodyHtml`.
- `Insert block after` materializes the installed Component snapshot immediately after the explicitly selected structural page block. There is no append fallback when no block is selected.
- `Move up`, `Move down`, and `Delete block` operate on the selected page-local instance. They never mutate or uninstall the Workshop package.
- Component placement does not depend on caret geometry, browser focus transfer, or selection hit-testing.
- Editor chrome, insertion markers, selection state, and block handles are transient UI and MUST NOT be persisted into the page HTML.
- When an inserted Component instance is deleted, Web Studio reconciles `workshopComponentInsertions` with the surviving `data-workshop-component-snapshot` instances so metadata cannot outlive the page-local snapshot.
- Removing the installed source package still MUST NOT remove already inserted page-local instances (`Installed != Inserted`).
