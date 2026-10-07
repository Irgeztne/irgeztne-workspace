const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
const i18n = fs.readFileSync(path.join(root, 'src/i18n.js'), 'utf8');
const projects = fs.readFileSync(path.join(root, 'src/modules/projects/projects-v0.js'), 'utf8');
const documents = fs.readFileSync(path.join(root, 'src/modules/documents/documents-v0.js'), 'utf8');
const studio = fs.readFileSync(path.join(root, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js'), 'utf8');
const studioCss = fs.readFileSync(path.join(root, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.css'), 'utf8');
const workshopCss = fs.readFileSync(path.join(root, 'src/v88-codehub-v1.css'), 'utf8');

assert.strictEqual((app.match(/new CustomEvent\('irg:language-changed'/g) || []).length, 0, 'app.js still emits a duplicate locale event.');
assert(i18n.includes("document.dispatchEvent(new CustomEvent('irg:language-changed'"), 'Canonical locale event is missing.');
assert(!i18n.includes("window.dispatchEvent(new CustomEvent('irg:language-changed'"), 'Canonical locale flow still emits the same bubbling event twice.');
assert(projects.includes("document.addEventListener('irg:language-changed', renderAll)"));
assert(documents.includes("document.addEventListener('irg:language-changed', renderAll)"));
assert(studio.includes("document.addEventListener('irg:language-changed'"), 'Web Studio does not inherit host locale.');
assert(!projects.includes('>Open</button>') && !projects.includes('>Detach</button>'), 'Projects contains runtime English-only action labels.');
assert(studioCss.includes('IRGEZTNE_WEBSTUDIO_LIGHT_LAYERS_V102'));
assert(workshopCss.includes('IRGEZTNE_WORKSHOP_LIGHT_LAYERS_V102'));

console.log('PASS: Host locale rerenders open surfaces and Web Studio/Workshop have stronger light-only layers.');
