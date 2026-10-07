# IRGEZTNE Preview.4 — Current State

> **Historical snapshot:** this file records the Storage Core state on
> 2026-05-22 and is not the current cross-module release status. Use
> [`docs/release/00-READ-ME-FIRST.md`](docs/release/00-READ-ME-FIRST.md) for the
> canonical documentation index. The dated evidence below is retained unchanged.

## Current stable point

Date: 2026-05-22

The current working baseline is after Storage Core v7g4 step 3.

The app opens normally.
Web Studio opens normally.
Sites, Pages, Design, Templates and Server open normally.
RU/EN switching works.
Cabinet cards and top menu drag/reorder work and persist after restart.
Web Studio normal state/design now persists through Storage Core.

## Storage Core status

Storage Core foundation is installed.

Files added:

- src/storage/storage-core-main.js
- src/storage/storage-schema.js
- src/storage/storage-secrets.js

Storage Core test passed inside Electron.

Confirmed:

- SQLite database works.
- Schema version 1 works.
- app preferences/layout storage works.
- module state storage works.
- encrypted secrets helper works.
- Electron safeStorage is available.

## v7g4 step 2 status

v7g4 step 2 redo was applied successfully.

Confirmed active integration in:

- main.js
- preload.js
- src/preview4-cabinet-card-drag-v1.js
- src/preview4-cabinet-nav-drag-v1.js
- src/services/storage.js

Confirmed by testing:

- app opens;
- RU/EN switches;
- cards drag/reorder;
- top menu drag/reorder;
- after full app restart, order remains.

This is now considered the stable Storage Core layout/preferences baseline.

## v7g4 step 3 status

v7g4 step 3 Web Studio storage without secrets was applied successfully.

Confirmed by testing:

- app opens;
- Web Studio opens;
- Sites / Pages / Design / Templates / Server open;
- page editor opens;
- templates open;
- after changing logo/favicon/design colors and fully restarting the app, changes remain.

This confirms ordinary Web Studio state/design is now saving through Storage Core.

## Important rule

Do not apply old failed v7g4 quick hotfixes again.

Do not use the older broken attempts:

- quick SQLite hotfixes;
- token runtime hotfixes;
- single-source hotfix that caused dark screen;
- old storage patches that mixed LocalStorage and SQLite incorrectly.

Continue only from the stable Storage Core plan and current working baseline.

## Storage architecture decision

LocalStorage must not be used as the application state source.

Storage Core / SQLite owns:

- app language;
- app theme;
- card order;
- top menu order;
- pinned/open sections;
- Web Studio;
- sites;
- pages;
- design;
- templates;
- server/publish profiles;
- projects;
- notes;
- office/documents;
- tools;
- CodeHub;
- knowledge;
- analytics;
- future modules.

Provider secrets must be stored separately as encrypted local secrets.

Generated website exports must not include:

- provider tokens;
- authorization headers;
- account secrets;
- encrypted secrets;
- internal database files;
- app backup data.

## Tokens / secrets status

Tokens are not migrated yet.

Next separate step:

v7g4 step 4 — encrypted secrets for Server tokens.

Planned behavior:

- Netlify token saved encrypted.
- Cloudflare token saved encrypted.
- Vercel token saved encrypted later.
- UI shows only hasToken/tokenPreview.
- Empty token field must not delete saved token.
- Token deletion only through explicit Clear token action.
- ZIP/export/meta.json must stay clean.

## Git / database safety

SQLite/local app data must not be committed to GitHub.

.gitignore already includes:

- data/*.db
- data/*.db-wal
- data/*.db-shm
- data/**/storage-secret.key
- *.sqlite
- *.sqlite3
- storage-secret.key
- *.local.json

Before GitHub commit, check:

find . -name "*.db" -o -name "*.db-wal" -o -name "*.db-shm" -o -name "storage-secret.key"

Do not commit real local databases or secrets.

## Module structure audit

There is a separate file:

PATCH_NOTES_PREVIEW4_MODULE_STRUCTURE_AUDIT.md

The audit showed many module/store files still live directly in src.

Future cleanup should organize modules more clearly, for example:

- src/storage/*
- src/modules/codehub/*
- src/modules/knowledge/*
- src/modules/library/*
- src/modules/projects/*
- src/modules/notes/*
- src/modules/templates/*
- src/modules/editor/*
- src/modules/web-studio/* later if needed

Do not mix this cleanup with risky Storage Core changes in one big patch.

## Next planned step

Next step:

v7g4 step 4 — encrypted secrets for Web Studio Server tokens.

Before step 4:

1. Make backup.
2. Confirm app opens.
3. Confirm Web Studio opens.
4. Confirm current design/state persists.
5. Apply only secrets patch.
6. Test Netlify token save/restart.
7. Test Cloudflare token save/restart.
8. Confirm export ZIP contains no token/secret.

## Backups

Important backups made around this stage include:

- stable before clean storage redo;
- v7g4 step2 redo storage layout OK;
- v7g4 step3 Web Studio storage OK.

Keep these backups until Storage Core and encrypted secrets are fully stable.
