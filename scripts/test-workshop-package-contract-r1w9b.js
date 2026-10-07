'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const base = fs.readFileSync(path.join(root, 'docs/workshop/IRGEZTNE-WEB-STUDIO-PACKAGE-CONTRACT-v1.md'), 'utf8');
const template = fs.readFileSync(path.join(root, 'docs/WEBSTUDIO-TEMPLATE-CONTRACT-v1.md'), 'utf8');
const frozen = fs.readFileSync(path.join(root, 'docs/workshop/IRGEZTNE-WORKSHOP-WEB-STUDIO-CYCLE-CONTRACT-v1.md'), 'utf8');

const checks = [
  [base, 'Exactly four website-package families'],
  [base, 'snapshot, not live-link'],
  [base, 'Package-to-package dependencies'],
  [base, 'Author, publisher and trust are separate'],
  [base, 'Rights and third-party notices'],
  [base, 'Schema version and package version are different'],
  [base, 'Update and rollback semantics'],
  [base, 'Type profiles and enablement gate'],
  [template, 'Base Package Contract'],
  [template, 'passive screenshot/card alone does not satisfy the preview contract'],
  [frozen, 'Package types for v1 are **Template, Theme, Component/Block, Site Widget**']
];

for (const [text, needle] of checks) {
  if (!text.includes(needle)) {
    console.error('R1W9B contract lint failed: missing:', needle);
    process.exit(1);
  }
}

console.log('R1W9B CONTRACT LINT OK: base/type split, routing/filtering, schema evolution, trust, rights, dependency policy, snapshot semantics, rollback and real adapter gates are present.');
