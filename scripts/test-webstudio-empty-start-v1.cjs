'use strict';
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');const dom=new JSDOM('<!doctype html><body></body>',{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;const states=new Map();const observers=[];const O=w.MutationObserver;w.MutationObserver=class extends O{constructor(fn){super(fn);observers.push(this);}};
w.console={log(){},warn(){},error(){}};w.confirm=()=>true;w.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},clearRect(){},fillText(){},beginPath(){},arc(){},fill(){},measureText(){return {width:10}}});w.HTMLCanvasElement.prototype.toDataURL=()=>'';
w.nsAPI={storageGetModuleStateSync:(k,f)=>states.has(k)?structuredClone(states.get(k)):f,storageSetModuleStateSync:(k,v)=>{states.set(k,structuredClone(v));return {ok:true};},storageSecretHasSync(){return false},storageSecretPreviewSync(){return '';}};
try{
 w.eval(fs.readFileSync(path.join(root,'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js'),'utf8').split('// 1.0.0 v5 exit/back safe')[0]);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));const api=w.IRGEZTNESiteStudioSafeV5;
 api.openTab('sites');assert.equal(states.get('webstudio.siteManager.v1').sites.length,0,'fresh profile creates no saved site');
 api.openTab('page');assert.equal(w.document.querySelectorAll('[data-v084b-editor-frame]').length,0,'no editor is created before choosing a site');assert.equal(states.get('webstudio.siteManager.v1').sites.length,0);
 const draft=api.readState();states.set('webstudio.siteManager.v1',{version:1,activeSiteId:'test',sites:[{id:'test',name:'TEST',state:draft}]});api.openTab('sites');const button=w.document.querySelector('[data-v5-action="site-delete"]');assert(button);assert.equal(button.disabled,false,'last test site can be deleted');button.click();assert.equal(states.get('webstudio.siteManager.v1').sites.length,0);
 api.openTab('sites');api.readState();assert.equal(states.get('webstudio.siteManager.v1').sites.length,0,'read/reopen does not resurrect deleted site');console.log('PASS: fresh zero-site manager, no editor auto-create, last site deletion, reopen/read remain empty (actual DOM; not Electron E2E)');
}finally{for(const o of observers)o.disconnect();w.close();}
