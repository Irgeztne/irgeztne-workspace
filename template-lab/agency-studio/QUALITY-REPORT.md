# Agency / Studio Canon v1b — Quality Report

## Scope

- 5 real pages in RU: Home, Cases, Services, Process, Contact.
- 5 real pages in EN: Home, Cases, Services, Process, Contact.
- Separate language folders; no runtime RU/EN switch.
- Light and dark themes.
- Mobile navigation.
- 4 local Agency-specific images; no external image requests.

## Automated checks

- 10 HTML pages present.
- 162 local `href` / `src` references resolved.
- Main and footer navigation contain the same five routes on every page.
- Exactly one active main route on every page.
- No Cyrillic visible text in EN pages.
- No unexpected English phrases in RU pages; Latin text is limited to brand and case names.
- No external URLs, fixed email, phone, messenger, location, timezone or language-profile data.
- No internal language switch.
- JavaScript syntax passed.
- CSS braces balanced.
- Header is full-width, opaque and has no blur/transparency.
- The main-page hero no longer forces a 650 px grid row.
- The square hero image is absolutely fitted inside a 560 px media frame and can no longer enlarge the row through its intrinsic aspect ratio.
- The metrics follow the actions with a normal 28 px gap instead of being forced to the bottom with `margin-top: auto`.
- The RU build contains no `Field Notes`; the visible title and image description use `Полевые заметки`.

## Visual assets

All four images were created specifically for Agency / Studio and stored locally:

- `agency-architecture.webp`
- `agency-identity.webp`
- `agency-digital.webp`
- `agency-process.webp`

Business, Blog / News and Portfolio assets are not used.

Release note: the separate Media Rights Pass is now complete. The four packaged
images are accepted as derivatives of the recorded Agency source master; see
`MEDIA-RIGHTS.md`.
