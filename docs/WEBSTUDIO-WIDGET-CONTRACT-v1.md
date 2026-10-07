# IRGEZTNE Web Studio — Site Widget Implementation Bridge v1

**Implementation pass:** R1W9H — Contract Reconciliation + Final UX Closeout  
**Status:** lifecycle foundation manually proven on 2026-09-09; final Add/Edit UX smoke remains before Widget adapter REAL PASS / FROZEN.  
**Normative contract:** `docs/workshop/IRGEZTNE-SITE-WIDGET-CONTRACT-v1.md` — **FROZEN**.

## 1. Authority

This file is an implementation bridge only. It does not redefine the frozen Site Widget Contract v1.

The frozen child contract is authoritative for Widget runtime, placement, management, Host Theme Context, Package Check, lifecycle and commercial-layer boundaries.

## 2. Reconciled lifecycle

```text
Workshop
  -> Installed Widget
  -> Add to Site
  -> Configure
  -> Choose Placement
  -> Confirm
  -> Site Widget Instance
```

Installing a Widget does not mutate a site. A Site Widget Instance is separate from page `bodyHtml` and separate from the installed Workshop source package.

## 3. Widget is not Component/Block

Component/Block remains structural page content and may use contextual `insert after block` semantics.

Widget is functional integration. R1W9H therefore rejects the first R1W9G assumption:

```text
Widget = iframe placeholder inserted after selected DOM block
```

New Widget instances are stored as page-local Widget state and rendered through normalized Host Surfaces.

## 4. Placement

R1W9H implements the frozen placement vocabulary:

- `flow`
- `region`
- `bar`
- `floating`

The package declares supported placement choices. Web Studio owns the concrete geometry and maps semantic regions onto the current template. Widget packages never target template CSS selectors or DOM internals.

## 5. Runtime and management

The implementation recognizes:

- local sandboxed Widget runtime;
- hosted iframe integration with declared HTTPS origin;
- local / external / hybrid management metadata.

Arbitrary third-party script injection, Node.js, Electron, Workspace filesystem access, process execution and private site-output secrets are outside Widget v1.

## 6. Host Theme Context

A Widget may declare `inherit`, `variants`, or `self-contained` theme behavior. Web Studio may provide only the bounded read-only Host Theme Context defined by the frozen contract. No raw Theme CSS or template DOM access is granted.

## 7. Workshop boundary

Workshop remains the Package Check / “Customs” boundary and owns package validation, integrity, installed bytes and source uninstall lifecycle.

Web Studio consumes the public adapter only:

- `NSCodeHubV1.getInstalledWidgets()`
- `NSCodeHubV1.materializeInstalledWidgetSnapshot(packageId)`

Package Check validates the declared Widget descriptor before the package becomes usable in Web Studio.

## 8. Installed != Site Instance

At first Add-to-Site, Web Studio stores a verified site-local source snapshot and a page-local Widget instance containing configuration and placement state.

Removing the installed source package must not silently delete an existing local Site Widget Instance. Updating the source package must not silently rewrite an existing instance.

## 9. Legacy R1W9G reconciliation

An old R1W9G `data-workshop-widget-snapshot` placeholder may be migrated once into separate Widget instance state. The old placeholder is removed from `page.bodyHtml` and receives a safe semantic fallback placement.

New R1W9H instances never write Widget placement markers into `page.bodyHtml`.

## 10. REAL PASS gate

Automated regression PASS is not enough. A local Contract-v1 test Widget must prove:

```text
install
-> configure
-> choose placement
-> add to site
-> interact in Editor
-> interact in Preview/Open Site
-> restart
-> instance survives
-> uninstall source Widget
-> restart
-> local instance survives and still functions
```

Placement modes should also receive focused manual smoke so `flow`, `region`, `bar`, and `floating` are not merely manifest vocabulary.

Only then may the Widget adapter be recorded as REAL PASS / FROZEN.

### Current R1W9H capability subset

The FROZEN child contract is broader than the first adapter implementation. R1W9H intentionally enables only capabilities that have a concrete bounded adapter. `localStorage` and author-controlled `externalLinks` remain reserved in this implementation and are rejected when requested rather than being silently approximated. Unsupported capabilities must fail closed until their dedicated host adapter exists.

## 11. Final Add/Edit UX closeout

The final 1.0 UX keeps the R1W9H architecture unchanged and makes the lifecycle explicit to the user:

- new instance: **Configure -> Placement -> Add to Site**;
- existing instance: **Settings -> Save changes**;
- one pending submit is allowed at a time; repeated clicks cannot create accidental duplicates;
- after successful add/update, the configuration surface closes and the affected Site Widget Instance is focused;
- contract enum values (`flow`, `main-end`, `medium`, etc.) remain stable in stored data while RU/EN UI shows human-readable labels;
- runtime state such as the current value of a demo counter is not part of site configuration persistence by default.

This is a UX closeout only. It does not change the frozen Runtime / Placement / Management model, Host Surface ownership, source-uninstall independence, or Package Check boundary.

## 12. Editor Widget presentation closeout

The real 2026-09-09 human smoke exposed one remaining editor-presentation defect: the
instance inspector rendered every Widget runtime as a large permanent card above
page content. That obscured the editable page and made the global Widget library
appear to follow structural block chrome.

R1W9H2 closes only that presentation defect:

- `Site Widgets` remains a top-level, on-demand management popover and no longer
  follows the selected block / `⋮` handle;
- the instance inspector lives inside that popover and shows compact management
  rows only (name, semantic placement, Settings, Remove);
- Widget runtime previews are removed from the permanent inspector stack;
- Editor uses non-persistent Host Surfaces outside the contenteditable HTML to
  show runtime instances near their semantic site placement;
- `page-top`, `after-header`, `main-start` are represented before editable page
  content; `main-end`, `before-footer`, `page-bottom` after it; `floating` is an
  overlay on the editor canvas; `bar` keeps full-width host geometry;
- these editor Host Surfaces are presentation only and are never serialized into
  `page.bodyHtml`.

Preview / Open Site / export remain authoritative for the complete generated-site
placement because the workbench edits page content rather than the generated
header/footer shell. No Runtime / Placement / Management contract value changes.
