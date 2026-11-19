#!/usr/bin/env bash
set -e

SANDBOX="/opt/IRGEZTNE Workspace/chrome-sandbox"
if [ -f "$SANDBOX" ]; then
  chown root:root "$SANDBOX" || true
  chmod 4755 "$SANDBOX" || true
fi

if [ -d /etc/apparmor.d ] && command -v apparmor_parser >/dev/null 2>&1; then
  cat > /etc/apparmor.d/irgeztne-workspace <<'APPARMOR'
abi <abi/4.0>,
include <tunables/global>

profile irgeztne-workspace "/opt/IRGEZTNE Workspace/irgeztne-workspace" flags=(unconfined) {
  userns,
  include if exists <local/irgeztne-workspace>
}
APPARMOR
  apparmor_parser -r -T -W /etc/apparmor.d/irgeztne-workspace || true
fi

DESKTOP="/usr/share/applications/irgeztne-workspace.desktop"
META_DIR="/usr/share/metainfo"
META="$META_DIR/com.irgeztne.workspace.metainfo.xml"

if [ -f "$DESKTOP" ]; then
  grep -q '^GenericName=' "$DESKTOP" || sed -i '/^Name=/a GenericName=Desktop workspace' "$DESKTOP"
  grep -q '^Keywords=' "$DESKTOP" || echo 'Keywords=IRGEZTNE;Workspace;Browser;Editor;Publishing;Notes;Files;' >> "$DESKTOP"
fi

mkdir -p "$META_DIR"

cat > "$META" <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
  <id>com.irgeztne.workspace</id>
  <launchable type="desktop-id">irgeztne-workspace.desktop</launchable>
  <name>IRGEZTNE Workspace</name>
  <icon type="stock">irgeztne-workspace</icon>
  <summary>Desktop workspace for browsing, writing, editing, and publishing preparation</summary>
  <metadata_license>CC0-1.0</metadata_license>
  <project_license>MPL-2.0</project_license>
  <developer id="com.irgeztne">
    <name>Irgeztne</name>
  </developer>
  <url type="homepage">https://irgeztne.com</url>
  <url type="bugtracker">https://github.com</url>
  <description>
    <p>IRGEZTNE Workspace is a local-first desktop workspace for browsing, writing, editing, organizing projects, and preparing web content for static-site publishing.</p>
  </description>
  <categories>
    <category>Utility</category>
    <category>Office</category>
  </categories>
  <releases>
    <release version="1.0.0" date="2026-11-19"/>
  </releases>
  <content_rating type="oars-1.1"/>
</component>
XML

gtk-update-icon-cache -f -t /usr/share/icons/hicolor || true
update-desktop-database /usr/share/applications || true
