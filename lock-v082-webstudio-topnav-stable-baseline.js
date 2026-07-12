const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();

const JS = path.join(ROOT, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js');
const CSS = path.join(ROOT, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.css');
const REGISTRY = path.join(ROOT, 'src/modules/editor-site-studio-safe/webstudio-template-registry-v083a.json');

const stamp = new Date().toISOString().replace(/[:.]/g, '-');

const baselineDir = path.join(ROOT, '_archive_project_cleanup', 'BASELINE-v082-webstudio-topnav-stable-' + stamp);
const reportFile = path.join(baselineDir, 'baseline-report.txt');
const verifyFile = path.join(ROOT, '_archive_project_cleanup', 'scripts', 'verify-v082-webstudio-topnav-baseline.js');

function read(file) {
  if (!fs.existsSync(file)) throw new Error('Не найден файл: ' + path.relative(ROOT, file));
  return fs.readFileSync(file, 'utf8');
}

function count(text, needle) {
  return String(text || '').split(needle).length - 1;
}

function copyIntoBaseline(file) {
  if (!fs.existsSync(file)) return;
  const name = path.relative(ROOT, file).replace(/[\\/]/g, '__');
  fs.copyFileSync(file, path.join(baselineDir, name));
}

fs.mkdirSync(baselineDir, { recursive: true });
fs.mkdirSync(path.dirname(verifyFile), { recursive: true });

const js = read(JS);
const css = read(CSS);

cp.execFileSync(process.execPath, ['--check', JS], { stdio: 'inherit' });

const checks = [
  ['JS', 'IRGEZTNE_V082_CLEAN_6_SINGLE_TOPNAV_OWNER', js, 1],
  ['JS', 'IRGEZTNE_V082_CLEAN_11_TEMPLATES_TAB_STABLE', js, 1],
  ['BOTH', 'ir-site-studio-v5-shell-tab-v082clean13', js + css, 1],
  ['JS', "return ['sites', 'templates', 'page', 'pages', 'menu', 'identity', 'preview', 'server']", js, 1],
  ['JS', "templates: ru ? 'Шаблоны' : 'Templates'", js, 1],
  ['JS', 'renderTemplatesTabV082Clean11', js, 1],
  ['CSS', 'IRGEZTNE_V082_CLEAN_12_REMOVE_TOPNAV_PSEUDO_LABEL_CSS', css, 1],
  ['CSS', 'IRGEZTNE_V082_CLEAN_13_ISOLATED_TOPNAV_CLASS_CSS', css, 1],
  ['JS', 'IRGEZTNE_DEBUG_TOPNAV_DOM_V082', js, 0],
  ['JS', 'IRGEZTNE_DEBUG_TOPNAV_INLINE_LABEL_V082', js, 0]
];

let ok = true;
const lines = [];

lines.push('IRGEZTNE / ELGESNY — Web Studio topnav stable baseline');
lines.push('Date: ' + new Date().toISOString());
lines.push('');
lines.push('Expected visible top navigation:');
lines.push('Сайты / Шаблоны / Редактор / Страницы / Меню / Дизайн / Предпросмотр / Сервер / Опубликовать');
lines.push('');
lines.push('Meaning:');
lines.push('- Top navigation is owned by JS renderWebStudioTopNavigationV082Clean6.');
lines.push('- Top buttons use isolated class .ir-site-studio-v5-shell-tab-v082clean13.');
lines.push('- Legacy .ir-site-studio-v5-tab pseudo-label CSS no longer owns topnav labels.');
lines.push('- Templates tab exists as a stable shell placeholder.');
lines.push('- Global top “Панель настроек” must not return.');
lines.push('');
lines.push('Checks:');

for (const [type, needle, source, expected] of checks) {
  const actual = count(source, needle);
  const pass = expected === 0 ? actual === 0 : actual >= expected;
  if (!pass) ok = false;
  lines.push((pass ? 'OK   ' : 'FAIL ') + type + ' :: ' + actual + ' :: ' + needle);
}

copyIntoBaseline(JS);
copyIntoBaseline(CSS);
copyIntoBaseline(REGISTRY);
copyIntoBaseline(path.join(ROOT, 'package.json'));

lines.push('');
lines.push('Source snapshots copied into baseline folder.');
lines.push('- ' + path.relative(ROOT, JS));
lines.push('- ' + path.relative(ROOT, CSS));
if (fs.existsSync(REGISTRY)) lines.push('- ' + path.relative(ROOT, REGISTRY));
lines.push('');

fs.writeFileSync(reportFile, lines.join('\n'), 'utf8');

const verifyScript = `
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const JS = path.join(ROOT, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js');
const CSS = path.join(ROOT, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.css');

function read(file) {
  if (!fs.existsSync(file)) throw new Error('Missing: ' + path.relative(ROOT, file));
  return fs.readFileSync(file, 'utf8');
}

function count(text, needle) {
  return String(text || '').split(needle).length - 1;
}

const js = read(JS);
const css = read(CSS);

cp.execFileSync(process.execPath, ['--check', JS], { stdio: 'inherit' });

const checks = [
  ['JS', 'IRGEZTNE_V082_CLEAN_6_SINGLE_TOPNAV_OWNER', js, 1],
  ['JS', 'IRGEZTNE_V082_CLEAN_11_TEMPLATES_TAB_STABLE', js, 1],
  ['BOTH', 'ir-site-studio-v5-shell-tab-v082clean13', js + css, 1],
  ['JS', "return ['sites', 'templates', 'page', 'pages', 'menu', 'identity', 'preview', 'server']", js, 1],
  ['JS', "templates: ru ? 'Шаблоны' : 'Templates'", js, 1],
  ['JS', 'renderTemplatesTabV082Clean11', js, 1],
  ['CSS', 'IRGEZTNE_V082_CLEAN_12_REMOVE_TOPNAV_PSEUDO_LABEL_CSS', css, 1],
  ['CSS', 'IRGEZTNE_V082_CLEAN_13_ISOLATED_TOPNAV_CLASS_CSS', css, 1],
  ['JS', 'IRGEZTNE_DEBUG_TOPNAV_DOM_V082', js, 0],
  ['JS', 'IRGEZTNE_DEBUG_TOPNAV_INLINE_LABEL_V082', js, 0]
];

let ok = true;
console.log('=== VERIFY v082 Web Studio topnav baseline ===');

for (const [type, needle, source, expected] of checks) {
  const actual = count(source, needle);
  const pass = expected === 0 ? actual === 0 : actual >= expected;
  if (!pass) ok = false;
  console.log((pass ? 'OK   ' : 'FAIL ') + type + ' :: ' + actual + ' :: ' + needle);
}

if (!ok) {
  console.error('\\nBaseline verification failed.');
  process.exit(1);
}

console.log('\\nOK: baseline verified.');
console.log('Expected UI: Сайты / Шаблоны / Редактор / Страницы / Меню / Дизайн / Предпросмотр / Сервер / Опубликовать');
`;

fs.writeFileSync(verifyFile, verifyScript.trimStart(), 'utf8');

console.log(ok ? 'OK: v082 Web Studio topnav baseline locked.' : 'WARNING: baseline report has failed checks.');
console.log('Baseline:', path.relative(ROOT, baselineDir));
console.log('Report:', path.relative(ROOT, reportFile));
console.log('Verify script:', path.relative(ROOT, verifyFile));
console.log('');
console.log('Quick check result:');
console.log(lines.filter(line => line.startsWith('OK') || line.startsWith('FAIL')).join('\n'));

if (!ok) process.exit(1);
