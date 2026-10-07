# IRGEZTNE WORKSPACE — RELEASE CONTINUITY ADDENDUM

**Date:** 2026-09-20  
**Purpose:** preserve release-relevant decisions from chat so they do not have to be reconstructed in a future session.

---

## 1. Linux packaging / desktop integration

### Accepted direction

For Ubuntu / Debian-family systems, the **`.deb` package remains the primary recommended Linux installer**.

AppImage remains an **alternative / portable package**, not the primary recommendation, because AppImage behavior and integration can vary by Linux distribution and may require additional system support on some Ubuntu 24.04 installations.

### Known Preview 3 problem

In the previously tested installed Preview 3 build:

- the `.deb` package itself installed successfully through the Ubuntu application installer/store;
- while the application was running, a temporary/generic gear-like icon was visible;
- after closing the application, the icon disappeared;
- the installed IRGEZTNE Workspace could not then be conveniently found and relaunched from Ubuntu Applications/search;
- the store only showed the package as installed and was not a reliable relaunch path;
- during current development, the application is relaunched with `npm start`, but this is **development-only behavior** and is unacceptable for an end user.

### Release requirement

A release `.deb` must behave as a normal installed Ubuntu desktop application:

- install without requiring the user to use `npm start`;
- create a valid `.desktop` launcher;
- appear in Ubuntu Applications;
- be searchable by `IRGEZTNE Workspace`;
- use the proper IRGEZTNE Workspace icon, not a generic gear;
- have a correct executable path;
- have consistent application identity / WM class so the running window groups under the correct launcher;
- support normal `Add to Favorites` / Dock pinning;
- remain launchable after the application has been closed;
- remain launchable after reboot;
- uninstall cleanly and remove its launcher.

### Packaging items to inspect

When the release build is reviewed, inspect at minimum:

- Electron `appId`;
- `productName`;
- `executableName`;
- Linux desktop entry;
- `Name`;
- `Exec`;
- `Icon`;
- `Categories`;
- `StartupWMClass` / desktop identity;
- installed path;
- generated `/usr/share/applications/*.desktop` entry;
- grouping of the running Electron window with the installed launcher.

This is a **release blocker for Linux desktop usability**, not cosmetic polish.

---

## 2. AppImage

AppImage is retained as an optional Linux distribution format.

Do not make AppImage the only or primary Ubuntu path.

Reason:

- it may not integrate automatically with the desktop;
- some Ubuntu 24.04 systems may require additional AppImage/FUSE support;
- behavior differs across distributions;
- `.deb` is a more natural primary package for Ubuntu/Debian users.

---

## 3. Electron security is independent of Account security

Even if most IRGEZTNE Workspace functionality remains local and does not require an Account, the Electron application itself still requires a separate security review.

The desktop security boundary must later include:

- Renderer;
- Preload;
- Main;
- IPC;
- filesystem access;
- external URL opening;
- navigation/window creation;
- local token/secret storage;
- HTML/content sanitization;
- Content Security Policy;
- package/update channel.

Account security and Electron security are separate security domains.

---

## 4. Workspace Account boundary

Keep the already accepted local-first rule.

Core/local Workspace functionality must continue to work without IRGEZTNE Account.

Connected functions currently expected to depend on Account include primarily:

- Chat;
- connected Workshop functions.

Do **not** turn Workspace startup into an Account wall.

Logging out of IRGEZTNE Account must not mean that the local Workspace application becomes unusable.

---

## 5. Weather — existing documentation already exists

Do not create a second parallel Weather architecture/documentation branch.

Existing Weather work has already reached a dedicated v1 final documentation/checkpoint stage dated **2026-09-12**.

Known archived/final materials include:

- `IRGEZTNE-WEATHER-PROVIDER-LAYER-v1-FINAL-DOCUMENTATION-CHECKPOINT-20260912.zip`
- `IRGEZTNE-WORKSPACE-WEATHER-v1-STABILITY-VISUAL-RC-20260912.zip`
- `IRGEZTNE-WORKSPACE-WEATHER-v1-LIVE-LOCATION-SYNC-RC-20260912.zip`
- canonical Workspace release documentation package from `2026-09-12`

Before editing Weather again:

1. locate/read the current Weather final documentation inside the active Workspace tree or its canonical documentation package;
2. do not reinterpret the completed Weather provider-layer work;
3. add only the remaining release task(s) to that existing documentation.

---

## 6. Weather — known remaining product task

The Weather widget already exists and is functional enough to remain in the Workspace release direction.

A known remaining improvement is:

### Country/location search

The current location/country selection does not conveniently expose all countries/locations.

Required follow-up:

- add a proper search field for country/location selection;
- avoid a small fixed list as the only way to choose location;
- preserve the existing provider/gateway abstraction;
- do not couple the UI directly to one weather provider;
- preserve RU/EN behavior;
- preserve Light/Dark behavior;
- keep graceful offline/provider-failure behavior.

The exact implementation must be checked against the current Weather v1 documentation before coding.

---

## 7. Economic / markets widget

For the first release, keep the existing economic/markets widget at its current accepted scope.

Do **not** expand it before v1 merely to add:

- large company coverage;
- broad market/company search;
- additional financial feeds;
- large new data-provider dependencies.

Its richer data-provider architecture can be revisited later.

---

## 8. Release sequencing

The remaining high-level order should stay disciplined:

1. stabilize and secure the IRGEZTNE Account foundation;
2. keep local Workspace independent from Account;
3. close Linux `.deb` desktop integration;
4. finish the known Weather country/location search item;
5. perform release polish/smoke testing;
6. do not expand the economic widget before v1;
7. verify final installers on Linux, Windows and macOS separately.

---

## 9. Continuity rule

Future chats must not reconstruct these points from memory.

Before changing:

- Linux packaging;
- Weather;
- Account boundary;
- Electron desktop lifecycle/security;

read this addendum together with the existing canonical Workspace release documentation and the existing Weather v1 final documentation.

Do not create parallel competing "current" documents unless the existing canonical file genuinely cannot be updated.

