# IRGEZTNE Workspace — Web Studio correction v092c

Base repository checkpoint:

```text
7b6fc21 Stabilize Web Studio public pages and Documentation
```

This correction package contains only changed source files. It does not contain
`data/`, Preview builds, tokens, local media, `node_modules`, or release
artifacts.

## Included corrections

- Compact Templates shows the real count of six official templates.
- “Choose template” passes the selected template to the existing new-site form.
- Editor Workbench can import local PNG, JPEG, WebP, and GIF images.
- Local images use the existing Web Studio media storage and relative public paths.
- Image blocks support S/M/L/100%, left/center/right placement, text-side placement,
  deletion, saving, reopening, Preview, ZIP, and publication packaging.
- Existing video media styling is now included for every official template,
  not only Landing.
- The public-page contract test covers all six templates, local image/video
  packaging, safe media paths, and generated media CSS.

## Apply on Ubuntu

First make a backup or a Git checkpoint of the current local repository.

Then extract this ZIP over the repository root:

```bash
cd ~/Загрузки/irgeztne-workspace-main
unzip -o ~/Загрузки/IRGEZTNE-WORKSPACE-WEBSTUDIO-v092c-correction.zip
```

Do not commit before visual acceptance.

## Static verification

```bash
cd ~/Загрузки/irgeztne-workspace-main
node scripts/test-webstudio-public-page-contract.js
git diff --check
```

Expected contract result:

```text
PASS: normalized public/fallback contract verified for 6 official templates
```

## Manual acceptance

1. Open compact Templates and confirm the counter shows `6`.
2. Choose Portfolio or another non-default template and confirm the same
   template is selected in the existing “Create website” form.
3. In Editor Workbench, place the caret between two text blocks.
4. Insert a local PNG/JPEG/WebP/GIF image.
5. Check S/M/L/100%, left/center/right placement, deletion, save, close/reopen,
   Preview, ZIP, and publication build.
6. Recheck one existing local video so the correction does not regress video.

This package intentionally does not include the unfinished wide Portfolio pass,
the H1/H2/H3 selected-fragment correction, or a release commit.
