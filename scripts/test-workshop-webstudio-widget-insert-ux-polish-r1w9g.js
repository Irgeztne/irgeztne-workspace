#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'src/modules/editor-workbench/editor-workbench.html'),'utf8');
const js=fs.readFileSync(path.join(root,'src/modules/editor-workbench/editor-workbench.js'),'utf8');
function must(c,m){if(!c)throw new Error(m)}
must(html.includes('data-action="widgets-open-r1w9h"'),'global Widget library entry missing');
must(!html.includes('data-action="widgets-open-context-r1w9h"'),'Widget still appears inside structural Block menu');
must(!html.includes('+ Вставить виджет после'),'old misleading Widget label remains');
must(js.includes('beginWidgetConfigurationR1W9H'),'configure-before-placement flow missing');
console.log('PASS: old R1W9G Widget insertion UX is superseded by R1W9H Add-to-Site -> Configure -> Placement flow.');
