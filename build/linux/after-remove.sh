#!/usr/bin/env bash
set -e

rm -f /usr/share/metainfo/com.irgeztne.workspace.metainfo.xml

update-desktop-database /usr/share/applications || true

rm -f /etc/apparmor.d/irgeztne-workspace || true
