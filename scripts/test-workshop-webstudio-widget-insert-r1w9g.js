#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');
const studio=fs.readFileSync(path.join(root,'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js'),'utf8');
const workbench=fs.readFileSync(path.join(root,'src/modules/editor-workbench/editor-workbench.js'),'utf8');
function must(c,m){if(!c)throw new Error(m)}
must(studio.includes('IRGEZTNE_WORKSHOP_WIDGET_CONTRACT_RECONCILIATION_R1W9H'),'R1W9G legacy test requires R1W9H reconciliation');
must(studio.includes('migrateLegacyWorkshopWidgetPlaceholdersR1W9H'),'legacy placeholder migration missing');
must(!workbench.includes("send('widget-insert-r1w9g'"),'rejected R1W9G insert action is still active');
must(!workbench.includes('__IRGEZTNE_WIDGET_INSERT_'),'rejected R1W9G marker generator is still active');
console.log('PASS: legacy R1W9G insertion assumptions are superseded by R1W9H; old placeholders are migration-only and new Widgets do not use Component-like DOM insertion.');
