# IRGEZTNE Workspace Account — User Surface v1 RC

Date: 2026-09-29  
Scope: Workspace Account user interface only  
Status: automated local PASS; Human Electron E2E required before FINAL/FROZEN

## Preserved boundaries

- The accepted Identity-first architecture is unchanged.
- Workspace remains local-first and local modules do not require Account.
- No email/password Account root was added.
- Identity Core, Recovery cryptography, preload/Main IPC, Account/Identity network clients and hardening H-01…H-13 were not modified.
- No deployment, remote migration, feature-flag activation, Cloudflare, D1 or DNS change was performed.
- Chat and Workshop Account/Capability E2E remain later stages.

## User-surface result

The active Identity-first Account surface now has exactly six distinct sections:

1. Profile
2. Identification
3. Security
4. Recovery
5. Services
6. Details

Profile is the default section. The former Overview duplication is removed. The expanded desktop rail and wide Account surface now follow only the six images in `IRGEZTNE-ACCOUNT-FINAL-VISUAL-REFS-20260929.zip`; the collapsed rail remains available. This does not replace Workspace navigation or change the accepted dark-only Workspace baseline.

The current Account/Profile contract has no avatar upload, replacement or removal capability and no app-owned avatar storage lifecycle. The surface therefore keeps a larger initials-based local avatar and does not imitate the unsupported camera/upload control shown in the visual reference.

Ordinary views use user-facing status text. AccountRecordID, IdentityID, DeviceID, security version, service environment, protected-storage backend and the Recovery file fingerprint are confined to Details.

Recovery creates an 18-word phrase from the system cryptographic random generator. The selected word space carries 126 bits of entropy. The phrase remains in renderer memory only, is not written to module state and is cleared after a Recovery file is successfully saved. The user must explicitly confirm that the phrase was stored separately.

Profile mutation is disabled unless the Account status is `ACTIVE`. `SECURITY_LOCKED`, `DELETION_PENDING`, `DELETED` and unknown inactive states remain readable but cannot change the profile.

Operations expose inline progress, controlled errors and success/warning states. Unknown backend messages are not rendered verbatim by the active Identity-first surface.

## Automated results

| Suite | Result |
|---|---:|
| Account user surface | 14/14 PASS |
| Account desktop UI contract | 7/7 PASS |
| Account foundation static contract | 12/12 PASS |
| Account Center static contract | 12/12 PASS |
| Account desktop Main | 10/10 PASS |
| Identity local core + Recovery + Account client + cross-platform secure storage | 31/31 PASS |
| Syntax check | PASS |

No browser or Electron runtime is installed in the packaging environment, so these automated results do not replace Human Electron visual acceptance.

## Human Electron E2E checklist

Run against the existing staging test profile, without creating a new Identity unless testing a disposable clean profile.

- [ ] Open Account repeatedly; no blank or stale surface appears.
- [ ] RU and EN switch all six section labels and user-facing content without changing Account state.
- [ ] After RU/EN switching, the expanded shell title remains `Account / Аккаунт` after the delayed global translation pass.
- [ ] Profile is the default section and shows understandable Account, service and Recovery states.
- [ ] At ordinary desktop size the Account surface is wide, the expanded sidebar is the default, headings and card text match the final visual canon scale, and the collapsed rail still works.
- [ ] The initials avatar is clearly presented without an inactive or misleading upload control.
- [ ] Profile saves display name and handle; progress and success are visible inline.
- [ ] Invalid handle and unavailable handle produce clear controlled errors.
- [ ] Identity and Security do not expose private keys, tokens, Recovery phrase or unnecessary protocol identifiers.
- [ ] Recovery phrase is readable with good contrast/caret behavior, can be shown/hidden, copied and regenerated.
- [ ] Recovery file cannot be saved until the separate-storage acknowledgement is checked.
- [ ] A saved Recovery file can be tested with the phrase; wrong phrase and modified file fail clearly.
- [ ] After an accepted restore, Recovery states that the same Account was preserved and the recovery generation increased.
- [ ] Services truthfully show Chat and Workshop Online as not connected; no capability is implied as active.
- [ ] Details contains support identifiers and Recovery fingerprint, while ordinary views do not.
- [ ] Disconnect removes only the local Account connection.
- [ ] Reconnect returns to the same Account/profile without creating a duplicate.
- [ ] Restart preserves the same Account/Profile/Identity continuity.
- [ ] Local Files, Projects, Office, Notes, Tasks, Tools and local Web Studio remain usable without Account.
- [ ] The accepted Dark-theme layout, focus ring, input contrast, scrolling and narrow-window responsiveness are acceptable. No global Light-theme result is claimed.

## Failure/adversarial checks before freeze

- [ ] Account service unavailable: local Workspace remains usable and a controlled error is shown.
- [ ] Identity service unavailable: action fails closed without changing local Identity.
- [ ] Protected storage unavailable: Identity/Account creation stays disabled.
- [ ] `SECURITY_LOCKED` Account cannot update Profile.
- [ ] `DELETION_PENDING` Account cannot update Profile.
- [ ] Repeated clicks during a running action do not submit a second operation.
- [ ] Recovery wrong phrase, wrong Identity file, stale file and integrity mismatch fail without raw internal errors.
- [ ] No private key, ServiceSubjectSeed, token, capability or Recovery phrase appears in the visible UI or logs used for the check.

Account must not be marked FINAL/FROZEN until this Human Electron checklist and the failure checks are accepted.
