# IRGEZTNE Workspace — Web Studio v095a

## Official Template Contract Completion

This is one cumulative correction pass for the six official Web Studio
templates. It does not rebuild Workspace, add a second template system, or
modify Atlas.

Apply it after the accepted chain:

1. `v092d-cumulative-correction`
2. `v092e-logo-identity-correction`
3. `v094a-wide-templates-editor-completion`
4. `v095a-official-template-contract-completion`

The package does not contain the user's database, profile, local websites,
uploaded media, publishing secrets, or Workspace settings. It does not create
a Git commit automatically.

## What was corrected

### One owner and one direct template identity

- The website's normalized `activeTemplate` is now the renderer owner.
- The renderer no longer guesses a template from the site name, tagline,
  descriptive text, or the last gallery selection stored in global
  `localStorage`.
- Legacy aliases still normalize to the six current Web Studio IDs.
- The old Workspace template surface remains a route/card surface into Web
  Studio; it no longer describes the official templates as empty styles
  without starter pages.

### One generated package

The full preview opened from `Templates` now materializes the same canonical
site package used by:

- Editor Preview;
- Open site in browser;
- ZIP export;
- publication.

The small iframe inside each template card remains a non-authoritative visual
thumbnail. The interactive full preview is the materialized package.

### Six official page contracts

| Template ID | Generated routes |
| --- | --- |
| `project-landing` | `index.html` |
| `business-product` | `index.html`, `services.html`, `about.html`, `contact.html` |
| `blog-news` | `index.html`, `articles.html`, `topics.html`, `about.html` |
| `documentation-wide` | `index.html`, `getting-started.html`, `guides.html`, `reference.html` |
| `studio-portfolio` | `index.html`, `works.html`, `about.html`, `contact.html` |
| `agency-studio` | `index.html`, `cases.html`, `services.html`, `contact.html` |

Every local HTML, CSS, JavaScript, favicon, manifest, image and page reference
in those packages is checked for route closure.

### Full starters and preserved user work

- New websites receive the full starter belonging to the selected official
  template.
- Known untouched compact starters from older Workspace builds are upgraded
  to the full home composition for Business, Blog, Portfolio and Agency.
- Migration runs only when a known old compact marker is present.
- User-authored or edited home HTML is not replaced.
- Existing Documentation metadata repair remains narrow and idempotent.

### Theme and sticky header

- The ordinary generated-site theme script now waits for the generated
  `<body>` before applying the saved theme. This fixes the light-only
  Documentation behavior inside inline/template Preview.
- Light/dark behavior remains available in browser and ZIP output.
- All six generated sites keep the site header sticky.
- Anchor scrolling now reserves `104px`, so section headings are not hidden
  under the sticky header.
- RU/EN remains a site-generation choice inherited from Web Studio. No runtime
  RU/EN switch was added to generated sites.

### Original local template images

The active renderer now packages the existing local Template Lab image assets
for:

- Business / Product: hero, feature and case;
- Blog / News: main story, technology, business, guide, workspace and city.

They are copied into `assets/template/...` in Preview, browser, ZIP and
publication packages. The package writer permits only image files contained
inside the official `template-lab` directory.

Landing, Documentation, Portfolio and Agency keep their prepared visual slot
markers and current neutral visual treatment. This pass does not claim that
user replacement of `data-template-slot` images is already implemented, and
it does not add external image services or remote demo URLs.

## Files installed

```text
main.js
scripts/test-webstudio-public-page-contract.js
src/preview4-official-templates-v1.js
src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js
template-lab/business-product/assets/business-hero-generated.webp
template-lab/business-product/assets/business-feature-generated.webp
template-lab/business-product/assets/business-case-generated.webp
template-lab/blog-news/assets/news-photo-main.jpg
template-lab/blog-news/assets/news-photo-tech.jpg
template-lab/blog-news/assets/news-photo-business.jpg
template-lab/blog-news/assets/news-photo-guide.jpg
template-lab/blog-news/assets/news-photo-workspace-lower.jpg
template-lab/blog-news/assets/news-photo-city-lower.jpg
```

## Installation

Stop Workspace first.

```bash
cd ~/Загрузки/irgeztne-workspace-main || exit 1

cp -a \
  ~/Загрузки/irgeztne-workspace-main \
  ~/Загрузки/irgeztne-workspace-main-backup-before-v095a

unzip -o \
  ~/Загрузки/IRGEZTNE-WORKSPACE-WEBSTUDIO-v095a-official-template-contract-completion.zip \
  -d ~/Загрузки/irgeztne-workspace-main
```

Run the contract test:

```bash
cd ~/Загрузки/irgeztne-workspace-main || exit 1
node scripts/test-webstudio-public-page-contract.js
```

Expected result:

```text
PASS: normalized public/fallback contract verified for 6 official templates
```

Then start Workspace:

```bash
npm start
```

## Visual acceptance

1. Open all six cards in `Web Studio → Templates`.
2. Use `Open preview`; verify that the full preview is a real multi-file site,
   not the old `template-lab/.../index.html` page and not a separate `srcdoc`
   build.
3. For each template, compare:
   - full Templates preview;
   - newly created website;
   - Editor Preview;
   - Open site in browser;
   - exported ZIP.
4. Check the route list in the table above and verify that the site logo returns
   to `index.html`.
5. Toggle light/dark in Documentation inside Preview and again in the browser.
6. Scroll every home page; the site header must remain visible.
7. Check Business and Blog with network disabled; their packaged images must
   remain visible.
8. Open an old untouched compact Portfolio or Agency test site; its home may
   migrate to the full starter. Open a site with user-edited home content and
   verify that the content is preserved.

Make the Git commit only after visual acceptance in the live repository.
