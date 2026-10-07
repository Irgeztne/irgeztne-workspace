# IRGEZTNE Workspace

IRGEZTNE Workspace is an early local-first desktop workspace built with Electron.

Current cross-module architecture, privacy boundaries, module ownership and
finalized subsystem references are indexed in
[`docs/release/00-READ-ME-FIRST.md`](docs/release/00-READ-ME-FIRST.md).
Historical preview notes below remain release history and do not override that
canonical documentation.

Preview.4 focuses on turning the project from a simple preview shell into a more practical workspace: browser shell, files, notes, projects, templates, and a much stronger Web Studio flow for creating and publishing static sites.

## Current preview release

Current version:

```txt
v1.0.0-preview.4
```

Release page:

https://github.com/Irgeztne/irgeztne-workspace/releases/tag/v1.0.0-preview.4

## Downloads

Early preview builds. Not code-signed yet.

Recommended downloads:

- Linux: `IRGEZTNE-Workspace-1.0.0-preview.4.deb`
- Windows: `IRGEZTNE-Workspace-1.0.0-preview.4.exe`
- macOS: `IRGEZTNE-Workspace-1.0.0-preview.4.dmg`

Additional build:

- Linux AppImage: `IRGEZTNE-Workspace-1.0.0-preview.4.AppImage`

Older preview releases are kept as historical builds. Preview.4 is the recommended version for new testing.

## Preview.4 highlights

- Web Studio with clearer Sites, Editor, Pages, Menu, Design, Preview, Server, and Publish workflow.
- One-time server setup separated from normal publishing.
- Cleaner page flow: normal pages appear in the header, footer pages are controlled from page settings.
- Compact logo and favicon generators with automatic site integration.
- Generated-site light/dark mode support.
- Official starter template previews for Modern Landing, Knowledge Base, and Studio Portfolio.
- Improved workspace navigation, draggable/rearrangeable cards and panel/menu areas.
- Better top panel and application shell polish.
- Notes, files, projects, tools, CodeHub, templates, rooms, and web analytics areas remain part of the broader workspace direction.

## Project status

- Electron: `41.3.0`
- npm audit: `0 vulnerabilities` expected for the current dependency set
- Linux `.deb` build target is supported
- Windows `.exe` and macOS `.dmg` are prepared through release packaging
- This is still an early public preview, not a final stable release

## Main modules

Current preview includes the early desktop workspace shell and core sections such as:

- browser/workspace shell
- Web Studio
- editor / office-oriented writing area
- files/source library
- notes
- projects
- tools
- templates
- CodeHub
- rooms
- web analytics

Some modules are still experimental and will be improved step by step.

## Web Studio note

Preview.4 Web Studio is designed for static websites. It focuses on local-first editing, generated pages, template previews, logo/favicon assets, local export, and publishing preparation.

Hosting providers and publishing flows should be tested before making production claims. Amazon/S3 is planned for a later stage and is not part of the current Preview.4 focus.

## Security note

This project uses Electron.

Do not place private data, tokens, secrets, API keys, or closed credentials inside the project folder before publishing or sharing archives.

## Known limitations

- This is a preview release, not a final stable release.
- Builds are not code-signed yet.
- AppImage may require `--no-sandbox` on some Linux systems.
- Documentation is still being written.
- Some modules are placeholders or early implementations.
- More templates, hosting providers, and publishing tools will be added gradually.

## License

Starting with `v1.0.0-preview.4`, IRGEZTNE Workspace source code is licensed under the Mozilla Public License 2.0 (`MPL-2.0`).

Earlier public preview releases from `v1.0.0-preview.1` to `v1.0.0-preview.3` were published under the MIT License. See `LICENSE_HISTORY.md`.

The IRGEZTNE name, IRGEZTNE Workspace name, logos, icons, and brand assets are not licensed for confusing or misleading use under the source-code license. See `TRADEMARKS.md`.

See the `LICENSE` file for the full MPL-2.0 license text.

## Contact

Email: irgeztne@gmail.com

Website:

https://irgeztne.com

Repository:

https://github.com/Irgeztne/irgeztne-workspace

Topics:

electron, desktop, workspace, browser, editor, publishing, local-first, static-sites, web-studio
