#!/usr/bin/env bash
set -e


SANDBOX="/opt/IRGEZTNE Workspace/chrome-sandbox"
if [ -f "$SANDBOX" ]; then
  chown root:root "$SANDBOX" || true
  chmod 4755 "$SANDBOX" || true
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
  <metadata_license>MIT</metadata_license>
  <project_license>MIT</project_license>
  <developer id="com.irgeztne">
    <name>Irgeztne</name>
  </developer>
  <url type="homepage">https://github.com/Irgeztne/irgeztne-workspace</url>
  <url type="bugtracker">https://github.com/Irgeztne/irgeztne-workspace/issues</url>
  <description>
    <p>IRGEZTNE Workspace is an early preview desktop workspace for browsing, writing, editing, organizing projects, and preparing web content for future publishing.</p>
    <p>The current preview includes a browser workspace shell, editor, notes, files/source library, project tools, and publishing preparation modules.</p>
    <p>Early preview builds are not code-signed yet.</p>
  </description>
  <categories>
    <category>Utility</category>
    <category>Office</category>
  </categories>
  <releases>
    <release version="1.0.0-preview.2" date="2026-04-29"/>
  </releases>
  <content_rating type="oars-1.1"/>
</component>

XML

gtk-update-icon-cache -f -t /usr/share/icons/hicolor || true
update-desktop-database /usr/share/applications || true
