#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');
const studio=fs.readFileSync(path.join(root,'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js'),'utf8');
function must(c,m){if(!c)throw new Error(m)}
must(studio.includes('function workshopWidgetHostCssR1W9H'),'R1W9H Host Surface CSS missing');
must(studio.includes('.irgeztne-widget-host-r1w9h.size-compact'),'semantic Widget sizes missing');
must(studio.includes('.irgeztne-widget-host-r1w9h.mode-bar'),'bar placement missing');
must(studio.includes('.irgeztne-widget-host-r1w9h.mode-floating'),'floating placement missing');
must(studio.includes('scrolling="no"'),'Widget runtime scrollbar suppression missing');
console.log('PASS: R1W9G2 CSS-fit workaround is superseded by R1W9H normalized Host Surface geometry and semantic placement.');
