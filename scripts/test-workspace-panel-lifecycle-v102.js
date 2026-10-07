const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const shell = fs.readFileSync(path.join(root, 'src/legacy-shell.js'), 'utf8');
const homePanel = fs.readFileSync(path.join(root, 'src/workspace-cabinet-panel-v0.js'), 'utf8');

assert(shell.includes('window.NSWorkspaceShell = {'), 'The active shell must publish one panel owner API.');
assert(shell.includes("document.addEventListener('visibilitychange'"), 'Visibility lifecycle reconciliation is missing.');
assert(shell.includes("window.addEventListener('pageshow'"), 'pageshow lifecycle reconciliation is missing.');
assert(shell.includes("window.addEventListener('focus'"), 'focus lifecycle reconciliation is missing.');
assert(shell.includes('reconcile: reconcileLifecycle'), 'Public lifecycle reconciliation is missing.');
const returnHome = homePanel.slice(homePanel.indexOf('function bindWorkspaceToggleReturnHome'), homePanel.indexOf('function init()', homePanel.indexOf('function bindWorkspaceToggleReturnHome')));
assert(!returnHome.includes('stopImmediatePropagation'), 'The Home widget still steals the Workspace toggle.');
assert(!returnHome.includes('preventDefault'), 'The Home widget still cancels the canonical Workspace toggle.');
assert(!/reload\s*\(/.test(returnHome), 'Panel lifecycle must not depend on reload.');

console.log('PASS: Workspace compact panel has one owner and reconciles navigation/window lifecycle without reload.');
