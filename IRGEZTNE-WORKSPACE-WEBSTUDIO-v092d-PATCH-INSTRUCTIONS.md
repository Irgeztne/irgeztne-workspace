# IRGEZTNE Workspace — Web Studio v092d cumulative correction

This ZIP is a cumulative correction package. It can be installed over:

- the current `v092c` test project; or
- the backup made before `v092c`.

It is not a standalone application and does not contain `node_modules`.

## What is included

- The website name no longer generates or replaces the Design logo.
- A new website starts with an empty logo mark; logo letters are configured only in **Design**.
- An empty logo mark is omitted from the Web Studio header, Preview, site ZIP and publication output.
- Existing manually configured logo letters remain unchanged.
- The public site never exports `Write page H1` / `Напишите H1 страницы`.
- A user-authored H1 in the editor is preserved without a second template H1.
- When an ordinary template needs a fallback H1, it uses the page name.
- Editor autosave now shows `Сохранить изменения` → `Сохранение…` → `Сохранено` (or the EN equivalents).
- `Сохранить страницу` is clarified as `Сохранить настройки страницы`.
- Export actions are clarified as current page `.html` versus whole site `.zip`.
- The local image/video pipeline and six-template selection fixes from `v092c` are included.

## Intentionally not changed

- Portfolio is still the current compact product renderer.
- Media blocks do not yet have vertical move/reorder controls.
- Canvas height and nested scrolling are reserved for a separate UX pass.
- The tooltip pointer and dark-preview menu contrast are reserved for a later polish pass.

## Install

Make a backup, then extract the ZIP over the complete project:

```bash
cd ~/Загрузки/irgeztne-workspace-main || exit 1

cp -a ~/Загрузки/irgeztne-workspace-main \
  ~/Загрузки/irgeztne-workspace-main-backup-before-v092d

unzip -o ~/Загрузки/IRGEZTNE-WORKSPACE-WEBSTUDIO-v092d-cumulative-correction.zip \
  -d ~/Загрузки/irgeztne-workspace-main

npm start
```

## Existing v092c test site

The package does not erase a saved logo value because it may be user-authored.
If the existing `4W` test site already saved `4W` in **Design → Logo → Letters / mark**,
clear that field once and leave it empty. New sites will no longer copy their names
into that field.

## Visual acceptance

1. Create a site with a long name and do not configure Logo letters.
2. Confirm the long name is text and no generated mark appears beside it.
3. In **Design**, enter independent logo letters and confirm they appear.
4. Clear the separate page H1 field, export the site ZIP and confirm no editor instruction appears in `index.html`.
5. Add an H1 inside the editor and confirm the exported page contains it only once.
6. Edit text and confirm the Save control changes state, then returns to `Сохранено`.
7. Confirm Preview says `Скачать текущую страницу (.html)` and Server says `Скачать весь сайт (.zip)`.

