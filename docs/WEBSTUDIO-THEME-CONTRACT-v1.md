# IRGEZTNE Web Studio Theme Contract v1

Status: **public local specialization / R1W9E REAL PASS / FROZEN**  
Owner boundary: **Workshop package -> Web Studio Design adapter**  
Base contract: `docs/workshop/IRGEZTNE-WEB-STUDIO-PACKAGE-CONTRACT-v1.md`

## 1. Purpose

A Theme package supplies a bounded, declarative set of Web Studio Design values. It does not know Web Studio private storage and it does not ship executable desktop extension code.

The v1 action is:

```text
Install Theme -> Web Studio / Design -> Apply Theme -> copy supported values into the current site
```

Installing is not applying.

## 2. Transport

A Theme uses the normal Workshop ZIP envelope with `irgeztne-package.json` at the root.

Required package fields follow the Base Package Contract, with:

- `package.type`: `theme`
- compatible product: `webstudio`
- semantic package version
- complete declared file list with sizes and SHA-256

A v1 Theme MUST contain `theme.json` at the ZIP root. Its manifest file entry MUST use:

- `path`: `theme.json`
- `role`: `main`
- `kind`: `data`
- `mime`: `application/json`

## 3. `theme.json` format

```json
{
  "format": "irgeztne-webstudio-theme",
  "formatVersion": "1.0",
  "theme": {
    "accentColor": "#7c3aed",
    "menuColor": "#7c3aed",
    "buttonColor": "#f97316",
    "backgroundColor": "#fff7ed",
    "textColor": "#1f2937",
    "fontFamily": "Manrope",
    "headingFont": "Montserrat"
  }
}
```

At least one supported Design field is required.

## 4. Supported v1 Design fields

Exactly these existing Web Studio site fields are eligible for Theme v1:

- `accentColor`
- `menuColor`
- `buttonColor`
- `backgroundColor`
- `textColor`
- `fontFamily`
- `headingFont`

Colors use full six-digit `#RRGGBB` values.

Fonts use one of Web Studio's existing font tokens:

`Inter`, `system`, `Manrope`, `Montserrat`, `Rubik`, `Nunito`, `Comfortaa`, `Oswald`, `Playfair`, `serif`, `geometric`, `JetBrains`, `mono`.

Unknown optional fields do not gain privileges and are ignored. Invalid values for supported fields reject the Theme package/materialization.

## 5. Identity is not Theme state

Theme v1 MUST NOT rewrite site identity:

- site name/author/tagline;
- logo letters, image, shape or logo colors;
- favicon mark, shape or favicon colors;
- pages/content/menu structure;
- publication credentials/settings.

This keeps reusable visual style separate from brand identity and site content.

## 6. No arbitrary CSS/JavaScript in Theme v1

Theme v1 is deliberately declarative. Applying a Theme does not execute package JavaScript and does not inject arbitrary package CSS into Web Studio.

This gives the Theme adapter a small deterministic security boundary and uses the renderer Web Studio already owns.

A future advanced styling profile would require its own explicit contract; it is not silently enabled by Theme v1.

## 7. Workshop ownership and public adapter

Workshop owns verification, installation, installed bytes and uninstall lifecycle.

Web Studio consumes Theme packages only through the public `NSCodeHubV1` boundary:

- `NSCodeHubV1.getInstalledThemes()` for safe discovery metadata;
- `NSCodeHubV1.materializeInstalledThemeSnapshot(packageId)` for apply.

The apply materializer re-reads the installed `theme.json` bytes, re-checks exact size and SHA-256, and parses the declarative theme again before handoff.

Web Studio does not read Workshop private localStorage or IndexedDB directly.

## 8. Installed is not applied

Installing a Theme only makes it visible in `Web Studio -> Design -> Installed themes`.

Applying is an explicit user action. On apply, Web Studio copies the supported Theme values into the current site's ordinary Design state and records provenance metadata.

The applied site does not keep a live dependency on the installed package.

Consequences:

- uninstalling the Theme later does not revert or damage the site;
- updating the installed Theme does not silently rewrite the site;
- the user may manually edit Design values after applying a Theme;
- reapplying or applying another Theme is another explicit action.

## 9. Structured-site boundary

Theme v1 applies only to structured Web Studio sites whose renderer uses the Design fields listed above.

A detached HTML/CSS/JavaScript site snapshot created from a Workshop Template is intentionally independent of Web Studio's structured renderer. Theme apply is therefore disabled for that site class rather than pretending to rewrite arbitrary HTML/CSS.

## 10. Current release gate

R1W9E entered as an implementation candidate until real user smoke proved:

1. a valid Theme ZIP installs;
2. it appears in Web Studio -> Design;
3. Apply changes a normal structured site's real preview;
4. restart preserves the applied Design state;
5. uninstalling the source Theme and restarting again leaves the applied site unchanged.

No REAL PASS is claimed before that smoke.

The required user smoke has now completed successfully: the Theme installed, appeared in Design, changed a structured site's real preview, survived restart, and remained applied after the source installed Theme was removed and Workspace restarted. Therefore **R1W9E = REAL PASS / FROZEN**.
