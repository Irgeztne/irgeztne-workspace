# IRGEZTNE Workspace

IRGEZTNE Workspace is a local-first desktop application built with Electron.

## Development status

Version **1.0.0 is in preparation and has not been released**.

This branch preserves the current development checkpoint. It is not an installable release, and functional closure and release verification remain incomplete.

Installers have been removed from the historical Preview 1–3 releases. Historical source archives and tags remain available for reference.

## Documentation

Start with [docs/release/00-READ-ME-FIRST.md](docs/release/00-READ-ME-FIRST.md) for architecture, privacy boundaries and subsystem documentation.

See [docs/IRGEZTNE-CONTINUATION-20261007.md](docs/IRGEZTNE-CONTINUATION-20261007.md) for the saved continuation checkpoint, known blockers and next steps.

Historical preview documents describe earlier states and do not establish current release readiness.

## Workspace modules

- Files and Projects
- Office and Notes
- Tasks and Tools
- Web Studio
- Workshop
- Chat
- Built-in Browser

Local Workspace functionality does not require an Account. Account authorization is used for connected Chat and Workshop Online services.

Account, Chat and Workshop retain separate security and data boundaries. Connected services use service-scoped authorization rather than master Account credentials.

## Web Studio

Web Studio provides static-site editing, templates, page management, preview, local export and publishing integrations.

The intended 1.0.0 publishing surface is:

- Local Export
- Netlify
- Cloudflare Pages
- Own Hosting: SFTP, with FTPS as a fallback

Listing an integration does not imply that its live release checks have passed. Outstanding verification is recorded in the continuation documentation.

## Related services

Account, Identity and Chat service sources are maintained separately in the IRGEZTNE services repository.

Saving source code to GitHub does not deploy services or apply database migrations.

## Security

Do not commit Account secrets, recovery phrases, provider credentials, private keys, local profiles or private backup archives.

## License

Current source code is licensed under the **Mozilla Public License 2.0 (MPL-2.0)**. See [LICENSE](LICENSE).

Historical Preview 1–3 releases were published under the MIT License. See [LICENSE_HISTORY.md](LICENSE_HISTORY.md).

Branding and trademark terms are described in [TRADEMARKS.md](TRADEMARKS.md).

## Contact

Email: [contact@irgeztne.com](mailto:contact@irgeztne.com)

Website: https://irgeztne.com/

Repository: https://github.com/Irgeztne/irgeztne-workspace
