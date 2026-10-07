#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const codehubPath = path.join(root, 'src/v88-codehub-v1.js');
const studioPath = path.join(root, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js');
const cssPath = path.join(root, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.css');
const baseContractPath = path.join(root, 'docs/workshop/IRGEZTNE-WEB-STUDIO-PACKAGE-CONTRACT-v1.md');
const templateContractPath = path.join(root, 'docs/WEBSTUDIO-TEMPLATE-CONTRACT-v1.md');
const codehub = fs.readFileSync(codehubPath, 'utf8');
const studio = fs.readFileSync(studioPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const baseContract = fs.readFileSync(baseContractPath, 'utf8');
const templateContract = fs.readFileSync(templateContractPath, 'utf8');

function has(text, needle, message) {
  if (!text.includes(needle)) throw new Error(message);
}
function lacks(text, needle, message) {
  if (text.includes(needle)) throw new Error(message);
}

// Preserve the public Workshop -> Web Studio ownership boundary proven by R1W9A/R1W9B.
has(codehub, 'IRGEZTNE_WORKSHOP_WEBSTUDIO_TEMPLATE_CONTRACT_V1', 'Workshop public template adapter owner is missing');
has(codehub, 'getInstalledTemplates: function ()', 'Workshop installed-template discovery API is missing');
has(codehub, 'getInstalledTemplatePreviewSrcdoc: function (packageId)', 'Workshop installed-template preview API is missing');
has(codehub, 'return buildWorkshopLivePreview(record);', 'Installed preview no longer reuses the proven Workshop preview builder');
has(studio, 'IRGEZTNE_WORKSHOP_TEMPLATE_LIBRARY_BRIDGE_R1W9A', 'Web Studio installed-template bridge is missing');
has(studio, 'data-v5-workshop-installed-templates-r1w9a="1"', 'Installed templates are no longer rendered in Web Studio Templates');
has(studio, "typeof api.getInstalledTemplates !== 'function'", 'Web Studio does not use the public discovery API');
has(studio, "typeof api.getInstalledTemplatePreviewSrcdoc !== 'function'", 'Web Studio does not use the public preview API');
lacks(studio, 'irgeztne-workshop-installed-v1', 'Web Studio illegally reads Workshop registry storage directly');
lacks(studio, 'irgeztne-workshop-bytes-v1', 'Web Studio illegally reads Workshop byte storage directly');

// R1W9C: the card must expose an obvious, reachable preview action rather than a dead screenshot.
has(studio, 'IRGEZTNE_WORKSHOP_INSTALLED_TEMPLATE_PREVIEW_INTERACTION_R1W9C', 'Missing R1W9C runtime marker');
has(studio, 'ir-site-studio-v5-workshop-preview-hit-r1w9c', 'Installed template preview surface is not interactive');
has(studio, 'data-v5-action="workshop-installed-template-preview-r1w9c"', 'Installed template does not expose an explicit preview action');
has(studio, "action === 'workshop-installed-template-preview-r1w9c'", 'Web Studio click router does not handle the installed-template preview action');
has(studio, 'void openWorkshopInstalledTemplatePreviewR1W9A(', 'Preview action does not route into the installed-template preview owner');
has(studio, 'data-v5-workshop-template-preview-full-r1w9a="1"', 'Full installed-template preview iframe is missing');
has(studio, 'sandbox="allow-scripts"', 'Installed-template preview is not sandboxed');
has(css, 'IRGEZTNE_WORKSHOP_INSTALLED_TEMPLATE_PREVIEW_INTERACTION_R1W9C', 'Missing R1W9C interaction styling');
has(css, '.ir-site-studio-v5-workshop-preview-hit-r1w9c', 'Preview hit-target styling is missing');
has(css, 'cursor: pointer;', 'Installed-template preview has no pointer affordance');
has(css, ':focus-visible', 'Installed-template preview lacks keyboard focus affordance');

// The hardened package contract remains installed and the adapter is still preview-only at this gate.
has(baseContract, '## 12. Installed is not applied', 'Base package contract lost Installed/Applied separation');
has(templateContract, 'snapshot', 'Template contract lost snapshot semantics');

console.log('PASS: R1W9C installed Workshop template has an explicit pointer/keyboard preview action routed through the public adapter into the sandboxed full preview');
