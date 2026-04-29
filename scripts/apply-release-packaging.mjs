import fs from "node:fs";
import path from "node:path";

const packagePath = path.resolve("package.json");

if (!fs.existsSync(packagePath)) {
  console.error("package.json not found. Run this script from the project root.");
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));

pkg.name = pkg.name || "irgeztne-workspace";
pkg.productName = "IRGEZTNE Workspace";
pkg.version = pkg.version || "1.0.0-preview.1";
pkg.license = "MIT";
pkg.homepage = pkg.homepage || "https://github.com/Irgeztne/irgeztne-workspace";
pkg.repository = {
  type: "git",
  url: "https://github.com/Irgeztne/irgeztne-workspace.git"
};
pkg.author = {
  name: "Irgeztne",
  email: "irgeztne@gmail.com"
};

pkg.scripts = pkg.scripts || {};
pkg.scripts.dist = pkg.scripts.dist || "electron-builder";

pkg.build = pkg.build || {};
pkg.build.appId = pkg.build.appId || "com.irgeztne.workspace";
pkg.build.productName = "IRGEZTNE Workspace";
pkg.build.directories = {
  ...(pkg.build.directories || {}),
  output: "dist"
};
pkg.build.files = pkg.build.files || [
  "**/*",
  "!dist/**",
  "!release-packaging/**",
  "!*.zip"
];

pkg.build.linux = {
  ...(pkg.build.linux || {}),
  target: (pkg.build.linux && pkg.build.linux.target) || ["deb", "AppImage"],
  icon: "build/icon.png",
  category: (pkg.build.linux && pkg.build.linux.category) || "Development"
};

pkg.build.win = {
  ...(pkg.build.win || {}),
  target: (pkg.build.win && pkg.build.win.target) || ["nsis"],
  icon: "build/icon.ico"
};

pkg.build.mac = {
  ...(pkg.build.mac || {}),
  target: (pkg.build.mac && pkg.build.mac.target) || ["dmg"],
  icon: "build/icon.icns",
  category: (pkg.build.mac && pkg.build.mac.category) || "public.app-category.developer-tools"
};

fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");
console.log("package.json updated for IRGEZTNE release packaging.");
