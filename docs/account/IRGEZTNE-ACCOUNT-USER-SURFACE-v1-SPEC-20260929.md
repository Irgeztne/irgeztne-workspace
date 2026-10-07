# IRGEZTNE Workspace — Account User Surface v1 Specification

**Status:** UI/UX specification for implementation  
**Date:** 2026-09-29  
**Product:** IRGEZTNE Workspace  
**Scope:** Account user surface only  
**Target location:** `docs/account/IRGEZTNE-ACCOUNT-USER-SURFACE-v1-SPEC-20260929.md`

---

## 1. Purpose

This document defines the final user-facing structure and behavior of **Account v1** inside IRGEZTNE Workspace.

It does **not** redesign the accepted Account / Identity / Recovery architecture. It translates the current working Account foundation into a coherent user interface.

The implementation must preserve the existing security model, local-first behavior, Identity continuity, Recovery continuity, secure-storage boundaries, and service isolation.

---

## 2. Product boundary

IRGEZTNE Workspace remains **local-first**.

Local Workspace modules continue to work without Account and without network access.

Account exists only for networked functionality that needs a user identity, service authorization, or communication.

### Current Account-dependent services

For Account v1, the only service surfaces are:

- **Chat**
- **Workshop Online**

### Not part of Account v1

Do not show or advertise these in the Account UI:

- IRGEZTNE Atlas
- Native P2P
- Hosting
- future storage products
- future or planned services
- “Coming soon” / “In development” service cards
- generic “Future services” sections

The architecture may remain extensible, but the UI must show only functionality that exists in the current release path.

---

## 3. Core UI rule: one function — one owner

Every user-facing function has one primary section.

Do not duplicate the same control, state, or detailed information across multiple Account sections.

If another section needs to reference a function, it may show only a short status and a link to the owner section.

Examples:

- Device management belongs to **Security**, not Identification.
- Recovery phrase and Recovery package belong to **Recovery**, not Security.
- IdentityID / DeviceID / recovery epoch belong to **Details**, not normal user screens.
- Chat and Workshop authorization belong to **Services**, not Profile.

---

## 4. Navigation

Account v1 has **six** user-facing sections:

1. **Профиль / Profile**
2. **Идентификация / Identification**
3. **Безопасность / Security**
4. **Восстановление / Recovery**
5. **Сервисы / Services**
6. **Сведения / Details**

### No Overview section

`Обзор / Overview` is removed from the final Account navigation.

The default Account landing section is **Profile**.

### Sidebar

Account uses a dedicated vertical sidebar inside the Account surface.

The sidebar must support:

- expanded mode: icon + section name;
- collapsed mode: icon-only rail;
- persistent active-section highlight;
- tooltip/title for icon-only items;
- no duplicate Workspace global navigation inside Account.

The Account sidebar is navigation for Account only.

---

## 5. Language

RU and EN are first-class.

In Russian mode, ordinary user-facing text must be Russian.

Do not mix generic English product terms into Russian sentences when a natural Russian term exists.

Preferred Russian UI terms:

- Account → **аккаунт**
- Identity → **идентификация** in ordinary user-facing text
- Security → **безопасность**
- Recovery → **восстановление**
- Services → **сервисы**
- Details → **сведения**

Canonical technical identifiers may remain in English only inside **Сведения / Details**, for example:

- `IdentityID`
- `DeviceID`
- `AccountRecordID`
- `recovery_epoch`

---

## 6. Profile

**Owner:** user profile data and optional private contact information.

### Required v1 content

- avatar;
- display name;
- `@handle`;
- optional email;
- save action;
- current Account status where useful.

### Avatar

The user may select/change an avatar.

Avatar is profile data. It is not Identity cryptographic material.

### Display name

Human-readable name shown where a service needs to identify the user.

### @handle

Stable user-facing handle subject to the existing validation and change policy.

### Email

Email is **optional**.

It is private Account contact information and must not become:

- the cryptographic Identity root;
- the primary Account identifier;
- a mandatory Workspace login;
- a publicly visible profile field by default.

User-facing explanation:

> Email нужен только для важных сообщений и уведомлений, связанных с вашим аккаунтом, безопасностью и сетевыми сервисами. Он не показывается публично и не используется как основной способ входа.

English equivalent:

> Email is used only for important messages and notifications related to your account, security, and online services. It is not shown publicly and is not used as the primary sign-in method.

If email notification preferences are supported by the current Account service, expose them here. Do not invent a notification system that does not exist.

### Visibility

The Account itself is private.

Profile data may be used by Chat or Workshop only where required by that service.

Creating or synchronizing an Account must **not** automatically create a public web profile.

No public-profile links, GitHub, website, social links, biography, or public-page controls are required for Account v1 unless a real current service uses them.

---

## 7. Identification

**Owner:** user-facing state of the cryptographic Identity and its continuity.

Identification must answer:

- Is the Identity active and valid?
- Is it linked to the same Account?
- Is continuity preserved after Recovery?
- Is the Identity private?

### Main content

- Identification status;
- Account link status;
- continuity status;
- privacy explanation;
- last relevant verification where available.

### Must not contain

- device-management controls;
- Passkey management;
- Recovery phrase/package controls;
- IdentityID / DeviceID / recovery epoch on the main surface;
- secure-storage controls;
- service authorization controls.

### Cross-links

Identification may link to:

- **Security** for device/local protection;
- **Recovery** for recovery actions;
- **Details** for technical identifiers.

Do not duplicate those sections.

---

## 8. Security

**Owner:** protection of the current Workspace installation and Account connection on the device.

### Main content

- overall security state;
- current device;
- protected OS storage state;
- local protection state;
- Account connection state on this device;
- disconnect current device / local Account connection;
- sign out when semantically distinct and supported.

### Protected storage

Use the term:

**Защищённое хранилище устройства / Protected device storage**

This means the operating system's protected storage used for keys and protected local Account/Identity state.

Do not call this generic “Local Storage”, because that may be mistaken for a future IRGEZTNE storage product.

Do not show storage capacity/size as if it were a user file-storage service.

### Must not contain

- full Recovery phrase/package workflow;
- Identity continuity details;
- service-grant management;
- technical IDs.

A short Recovery status may link to the Recovery section, but detailed Recovery controls remain owned by Recovery.

---

## 9. Recovery

**Owner:** restoring the same Identity / Account continuity after loss, reinstall, or movement to a new device.

### Main content

- Recovery readiness/status;
- Recovery phrase;
- Recovery package/file;
- verification action;
- last successful verification;
- guidance for recovery on a new device;
- clear safety guidance.

### Recovery phrase

The current RC design uses a generated human-readable Recovery phrase.

Requirements:

- generated using system CSPRNG;
- 18 words;
- at least 126 bits of entropy;
- not persisted in normal Workspace renderer/module state after the intended flow;
- never sent to Chat or Workshop;
- never shown in normal Account pages outside Recovery.

### Recovery package

Show only real package/file functionality that exists in the current implementation.

The UI must explain what the package is for and how it is verified.

### Recovery outcome

The user-facing message must clearly state that successful Recovery preserves continuity and returns the user to the **same Account**, not a new duplicate Account.

### Must not contain

- device-management controls;
- secure-storage implementation details;
- technical fingerprints on the normal surface.

Technical Recovery fingerprint belongs in **Details**.

---

## 10. Services

**Owner:** Account authorization for networked services.

### Account v1 services

Only:

#### Chat

Status:

- connected;
- not connected;
- error/unavailable when real.

Purpose:

- online communication;
- service-specific access.

#### Workshop Online

Status:

- connected;
- not connected;
- error/unavailable when real.

Purpose:

- networked Workshop functionality;
- publication/collaboration features that require Account.

### Isolation

Each service is authorized separately.

Connecting Chat must not implicitly connect Workshop.

Connecting Workshop must not implicitly connect Chat.

The UI should communicate that each service receives only its own limited authorization.

### Must not show

- Atlas
- Native P2P
- Hosting
- Web Studio as a generic Account service
- future service placeholders
- “soon”
- “planned”
- “in development”

Space may be left structurally extensible in code, but the current UI contains only Chat and Workshop.

---

## 11. Details

**Owner:** technical information and diagnostics.

This is the only normal Account section where engineering identifiers may be shown.

### Account block

May include real available fields such as:

- Account status;
- Account creation date if available;
- last Account activity if available;
- interface language;
- AccountRecordID if useful for support.

Do not fabricate unsupported metadata such as a region field unless it is actually stored.

### Identification block

May include:

- IdentityID;
- continuity state;
- recovery epoch;
- Account linkage state;
- canonical technical Identity information useful for diagnostics.

### Current device block

May include:

- device name;
- OS/platform;
- Workspace application version;
- DeviceID;
- local protection state.

### Protected device storage block

Name:

**Защищённое хранилище устройства / Protected device storage**

May include:

- storage protection type/backend;
- availability status;
- what it is used for;
- last verification.

Do not present it as an IRGEZTNE file-storage product.

### Version and build

May include only real build/version information available to the app.

### Diagnostics

May expose safe user/support actions such as:

- refresh/check state;
- view a technical report;
- integrity/status checks that already exist.

Diagnostics must not expose private keys, Recovery phrase, provider credentials, bearer tokens, or unrestricted signing material.

---

## 12. Local-first boundary

This must remain visible in the Account experience without being repeated on every card.

Canonical meaning:

> Workspace works locally without an Account. Account is required only for online features.

Account must not gate local:

- Files;
- Projects;
- Office;
- Notes;
- Tasks;
- Tools;
- local Web Studio editing/preview/export;
- other existing local-only workflows.

No Account operation may imply automatic upload of local Workspace files.

---

## 13. Service/profile visibility model

Account is private by default.

A service may receive only the profile subset it actually needs.

Example principle:

- Chat may use display name, handle, avatar, and its own Chat-scoped subject.
- Workshop may use display name, handle, avatar, and its own Workshop-scoped subject.
- Email remains private unless a specific current Account workflow requires it.
- IdentityID, DeviceID, Recovery material, local Workspace files, and protected secrets are never profile fields for services.

Synchronization does not equal publication.

A future public profile, if ever needed, must be a separate explicit feature with explicit visibility controls. It is not part of Account v1.

---

## 14. Visual system

The approved visual direction is:

- dark navy / blue-gray Workspace surface;
- strong readable contrast;
- blue primary actions;
- green positive status;
- amber warning;
- red destructive action;
- rounded but restrained cards;
- consistent icon language;
- clear section hierarchy;
- minimal decorative chrome;
- no marketing-style future cards;
- no empty placeholder areas presented as features.

### Layout

- Account content should use the available workspace width rather than a small technical panel centered in large empty space.
- Sidebar width must be compact.
- Collapsed rail preserves icons and active state.
- Main content cards should be responsive.
- Details may use denser information layout than normal user sections.

### Light theme

All final Account surfaces must remain readable in Workspace light theme with sufficient contrast, visible borders, focus states, and form caret visibility.

### Accessibility

Preserve:

- keyboard focus;
- visible focus rings;
- readable caret;
- accessible labels;
- reduced-motion behavior;
- no critical state communicated by color alone.

---

## 15. Interaction states

Every actionable Account operation must support inline states:

- idle;
- busy/progress;
- success;
- warning;
- error.

Do not use raw backend error messages as primary user copy.

Do not rely on blocking `alert()` for normal Account operations.

Errors should be translated into user-facing RU/EN messages while preserving technical detail only in diagnostics/logs where appropriate.

---

## 16. Implementation boundary

This UI specification must be implemented **without redesigning the accepted architecture**.

Do not rewrite or replace:

- Identity Core;
- Recovery cryptographic model;
- secure-storage model;
- Main-owned Account token handling;
- narrow preload/IPC boundary;
- pairwise service subjects;
- Chat/Workshop service isolation;
- existing hardening controls.

The renderer must not gain:

- Root private material;
- Device private keys;
- Recovery secrets outside the intended Recovery flow;
- provider credentials;
- unrestricted signing;
- generic service bearer tokens.

---

## 17. Current accepted technical baseline

At the time of this specification, the accepted Account/Identity foundation includes:

- Identity hardening suite PASS;
- local Identity Core tests PASS;
- Recovery tests PASS;
- Identity → Account client tests PASS;
- cross-platform secure-storage tests PASS;
- Account Desktop Main tests PASS;
- Account Desktop UI contract tests PASS;
- Account User Surface regression tests PASS;
- disconnect/reconnect continuity accepted;
- Recovery continuity accepted;
- same Account retained after valid Recovery;
- current test profile continuity accepted.

This specification does not reopen already closed hardening work.

---

## 18. Implementation order

Recommended implementation order:

1. Account shell/sidebar/navigation;
2. Profile;
3. Identification;
4. Security;
5. Recovery;
6. Services;
7. Details;
8. RU/EN review;
9. accepted Dark-theme review;
10. Human Electron E2E;
11. adversarial/failure-state E2E;
12. Account v1 FINAL/FROZEN.

After Account is frozen, continue with:

1. Chat Identity / Capability E2E;
2. Workshop Online E2E;
3. Provider Credential Vault / publishing hardening;
4. Release Candidate work.

---

## 19. Acceptance criteria

Account User Surface v1 is ready to freeze when all of the following are true:

- no Overview tab remains;
- exactly six Account sections exist;
- each function has one owner section;
- no duplicated device/Recovery/service controls across sections;
- RU and EN are complete and natural;
- Profile contains only current v1 profile/contact fields;
- Account is private by default;
- email is optional/private and not the Identity root;
- Services contains only Chat and Workshop;
- no future products/services are advertised;
- Details contains the technical information removed from ordinary screens;
- protected OS storage is described accurately;
- local Workspace remains usable without Account;
- Human Electron E2E passes;
- failure states are understandable and do not expose raw internals;
- existing Account/Identity/Recovery security boundaries remain intact.

---

## 20. No-touch / do-not-regress

Do not:

- reintroduce Overview as a required Account section;
- make Account mandatory for local Workspace;
- turn email/password into the Identity root;
- expose Identity/Device private material to renderer;
- merge Chat and Workshop authorization;
- publish Account/profile automatically;
- add Atlas/P2P/Hosting/future-service cards to Account v1;
- duplicate the same function across multiple sections;
- treat conceptual visual mockups as permission to invent unsupported backend features.

The final UI must represent the product that exists now.

---

## 21. Final visual canon

The archive `IRGEZTNE-ACCOUNT-FINAL-VISUAL-REFS-20260929.zip` supersedes all older Account mockups. Only these six images are the visual canon for Account User Surface v1:

The specification remains authoritative for functionality and wording.  
The images are authoritative only for visual direction, layout, density, hierarchy, sidebar behavior, card treatment, and overall Account shell.

### Profile

- `01-PROFILE.png`

### Identification

- `02-IDENTIFICATION.png`

### Security

- `03-SECURITY.png`

### Recovery

- `04-RECOVERY.png`

### Services

- `05-SERVICES.png`

### Details

- `06-DETAILS.png`

### Reference priority

When implementation details differ between an image and this specification:

1. current working Account/Identity/Recovery behavior wins;
2. this specification defines functionality, ownership, copy, and boundaries;
3. these six final images define visual direction only.

Do not copy accidental/generated placeholder values, unsupported controls, future features, or mock data from the reference images.
