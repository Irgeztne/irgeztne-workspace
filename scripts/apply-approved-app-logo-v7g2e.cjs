const fs = require('fs');
const path = require('path');

const root = process.cwd();
function backup(file) {
  if (!fs.existsSync(file)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(file, file + `.bak-v7g2e-approved-logo-${stamp}`);
}

const mainPath = path.join(root, 'main.js');
if (fs.existsSync(mainPath)) {
  let s = fs.readFileSync(mainPath, 'utf8');
  backup(mainPath);

  if (!s.includes('function resolveIRGEZTNEAppIconPath')) {
    const marker = "const INDEX_URL = pathToFileURL(INDEX_FILE).toString();";
    const insert = `${marker}\n\nfunction resolveIRGEZTNEAppIconPath() {\n  const candidates = [\n    path.join(__dirname, 'build', 'icons', '512x512.png'),\n    path.join(__dirname, 'build', 'icons', '256x256.png'),\n    path.join(__dirname, 'build', 'icon.png'),\n    path.join(__dirname, 'assets', 'branding', 'app-mark.png')\n  ];\n  return candidates.find((candidate) => fs.existsSync(candidate)) || undefined;\n}\n\ntry {\n  app.setName('IRGEZTNE Workspace');\n}\ncatch {}\n`;
    if (s.includes(marker)) s = s.replace(marker, insert);
  }

  if (!s.includes('icon: resolveIRGEZTNEAppIconPath()')) {
    s = s.replace(/new BrowserWindow\(\{\s*/m, (m) => `${m}icon: resolveIRGEZTNEAppIconPath(),\n    `);
  }

  fs.writeFileSync(mainPath, s, 'utf8');
  console.log('[v7g2e] main.js updated: BrowserWindow icon now points to the approved logo.');
}

const indexPath = path.join(root, 'index.html');
if (fs.existsSync(indexPath)) {
  let s = fs.readFileSync(indexPath, 'utf8');
  backup(indexPath);
  s = s.replace(/href="\.\/assets\/branding\/favicon\.svg"/g, 'href="./assets/branding/favicon.png?v=v7g2e"');
  s = s.replace(/src="\.\/assets\/branding\/wordmark\.svg"/g, 'src="./assets/branding/app-mark.png?v=v7g2e"');
  s = s.replace(/src="\.\/assets\/branding\/app-mark\.svg"/g, 'src="./assets/branding/app-mark.png?v=v7g2e"');
  fs.writeFileSync(indexPath, s, 'utf8');
  console.log('[v7g2e] index.html updated: topbar brand image now uses the approved app-mark PNG.');
}

const cssPath = path.join(root, 'styles.css');
if (fs.existsSync(cssPath)) {
  let s = fs.readFileSync(cssPath, 'utf8');
  backup(cssPath);
  if (!s.includes('/* v7g2e approved app logo sizing */')) {
    s += `\n\n/* v7g2e approved app logo sizing */\n.brand-wordmark-image {\n  height: 36px;\n  width: 36px;\n  max-width: 36px;\n  border-radius: 10px;\n  object-fit: contain;\n  display: block;\n}\n.brand-wordmark-wrap {\n  align-items: center;\n}\n`;
  }
  fs.writeFileSync(cssPath, s, 'utf8');
  console.log('[v7g2e] styles.css updated: topbar logo sizing set for square icon.');
}
