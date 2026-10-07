# IRGEZTNE Business Canon v1 — x-ray

## What the existing `template-lab/business-product` already had

- A strong wide composition with a warm green/orange visual system.
- A full home-page narrative: hero, proof, features, case, process, CTA.
- Local Business image assets.
- Light and dark theme tokens.
- RU and EN dictionaries.

## Why it was not a finished site

- The brand link returned to the Template Lab gallery.
- Main navigation and footer links were placeholders.
- The original language object contained an invalid unquoted key with a space.
- The page mixed an internal runtime language dictionary with the newer
  single-language Web Studio contract.
- The preview prototype had no real independent inner pages.
- Image slot markers existed, but there was no proven active owner for replacing
  those images from Web Studio.

## Why the installed `v095a` result looked different

- Web Studio did not materialize the original Template Lab page as the Business
  site.
- It created a separate Business starter through the universal page renderer.
- The universal inner-page renderer automatically added a page kicker and
  repeated the menu/page title, producing the unwanted `СТРАНИЦА → Услуги`
  pattern.
- The same renderer added generic content and a generic page structure that did
  not preserve the original Business composition.
- A sticky header rule existed, but the actual scrolling owner differed between
  preview and browser modes. The canon uses one fixed header outside the content
  scroll flow.

## Canon v1 boundaries

- Standalone visual reference only; not integrated into Workspace.
- Four real pages in each language: Home, Services, Company, Contact.
- RU and EN are separate complete builds with no runtime language switch.
- One light/dark theme control.
- Local images only.
- Text brand fallback when no logo is supplied; no invented logo mark.
- Inner pages start with authored content, not a technical `Page` label or an
  automatic repeat of the menu item.
- Image markers remain future integration markers. Canon v1 does not claim that
  user image replacement is already connected.
