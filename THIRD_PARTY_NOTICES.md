# Third-Party Notices

IRGEZTNE Workspace uses open-source software and may include third-party assets.

## Application code

Starting with `v1.0.0-preview.4`, the original IRGEZTNE Workspace application code is released under the Mozilla Public License 2.0 (`MPL-2.0`).
See `LICENSE` and `LICENSE_HISTORY.md`.

## Electron and build tooling

Electron, electron-builder, Node.js packages, and other dependencies keep their own licenses.
Their license information is provided by their package metadata and should be preserved.

## Templates

Website templates must keep their original licenses and attribution rules.
Do not mark third-party templates as IRGEZTNE-owned code unless the template license allows it.

Recommended rule:

- IRGEZTNE app code: MPL-2.0 starting with `v1.0.0-preview.4`
- MIT templates: include with original license notice
- Attribution-required templates: preserve author credit/backlink where required
- Restricted templates: do not bundle inside the app until permission is confirmed


## Branding

The IRGEZTNE name, IRGEZTNE Workspace name, logos, icons, and brand assets are not part of third-party templates and are not licensed for confusing or misleading use under the source-code license.
See `TRADEMARKS.md`.

## Remote publishing transports

The Web Studio remote publishing path uses these third-party Node.js packages:

- `basic-ftp` 6.2.0 — MIT License — FTP and FTPS transport.
- `ssh2-sftp-client` 12.1.1 — Apache-2.0 License — SFTP transport over SSH2.

These packages and their transitive dependencies keep their own license terms and notices.

## Weather forecast data

The Weather module credits forecast data from the Norwegian Meteorological Institute (MET Norway),
Locationforecast 2.0. The applicable open-data licences are the Norwegian Licence for Open
Government Data (NLOD) 2.0 and/or Creative Commons Attribution 4.0 (CC BY 4.0), as specified by
MET Norway for the relevant dataset.

- Attribution: Data source: MET Norway
- Product: Locationforecast 2.0
- Licence information: https://api.met.no/doc/License
- Terms of service: https://api.met.no/doc/TermsOfService

The Weather UI presents these values truthfully as an automatic numerical weather-model forecast,
not as physical weather-station observations. MET Norway and Yr logos are not bundled or used.
