'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const dom=new JSDOM('<!doctype html><html lang="en"><body></body></html>',{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;const observers=[];const Observer=w.MutationObserver;w.MutationObserver=class extends Observer { constructor(fn){super(fn);observers.push(this);} };const modules=new Map();let accountOpened=0;
w.console={log(){},warn(){},error(){}};w.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},clearRect(){},fillText(){},beginPath(){},arc(){},fill(){},measureText(){return {width:10}}});w.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/png;base64,iVBORw0KGgo=';
w.nsAPI={storageGetModuleStateSync:(k,f)=>modules.has(k)?structuredClone(modules.get(k)):f,storageSetModuleStateSync:(k,v)=>{modules.set(k,structuredClone(v));return {ok:true}},storageSecretHasSync(){return false},storageSecretPreviewSync(){return ''}};
w.IRGEZTNEConnected={openAccountSurface(){accountOpened++}};
try{
 const src=fs.readFileSync(path.join(root,'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js'),'utf8').split('// 1.0.0 v5 exit/back safe')[0];w.eval(src);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));modules.set('webstudio.siteManager.v1',{version:1,activeSiteId:'fixture',sites:[{id:'fixture',name:'Fixture',state:w.IRGEZTNESiteStudioSafeV5.readState()}]});w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 const click=selector=>{const el=w.document.querySelector(selector);assert(el,selector);el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));};
 w.IRGEZTNESiteStudioSafeV5.openTab('publish');
 assert.deepEqual(Array.from(w.document.querySelectorAll('.ir-site-studio-v5-publish-provider-grid strong')).map(e=>e.textContent),['Local Export','Netlify','Cloudflare Pages','Own Hosting']);
 assert.equal(w.document.querySelectorAll('[data-v5-action="publish-download-starter-zip"]').length,0);
 click('[data-v5-provider="sftp"]');assert.equal(w.document.querySelectorAll('[data-v5-provider="ftps"]').length,1);assert.equal(w.document.querySelectorAll('[data-v5-provider="ftp"]').length,0);
 click('[data-v5-provider="ftps"]');assert.equal(w.IRGEZTNESiteStudioSafeV5.readState().site.publishSettings.selectedProvider,'ftps');
 click('[data-v5-action="toggle-studio-lang"]');assert.equal(w.localStorage.getItem('irgeztne.webStudio.lang.v1'),'ru');
 let shellLanguage='ru';w.__IRG_BROWSER_SHELL_API={getLanguage(){return shellLanguage},setLanguage(lang){shellLanguage=lang;w.document.dispatchEvent(new w.CustomEvent('irg:language-changed',{detail:{language:lang}}));}};click('[data-v5-action="toggle-studio-lang"]');assert.equal(shellLanguage,'en');assert.equal(w.localStorage.getItem('irgeztne.webStudio.lang.v1'),'en');
 click('[data-v5-action="toggle-studio-theme"]');assert.equal(w.localStorage.getItem('irgeztne.webStudio.theme.v1'),'light');
 click('[data-v5-action="open-account-release-r1"]');assert.equal(accountOpened,1);assert.equal(w.document.querySelectorAll('.ir-site-studio-v5-overlay.is-open').length,0);
 w.IRGEZTNESiteStudioSafeV5.openTab('sites');click('[data-v5-action="close"], [data-v5-action="exit-studio"], [data-v5-action="back-editor"]');assert.equal(w.document.querySelectorAll('.ir-site-studio-v5-overlay.is-open').length,0);
 // Simulate an old selected FTP profile, while keeping broker metadata.
 const manager=modules.get('webstudio.siteManager.v1');for(const s of manager.sites) {s.state.site.publishSettings.selectedProvider='ftp';s.state.site.publishSettings.providers.ftp.enabled=true;}
 modules.set('webstudio.siteManager.v1',manager);w.IRGEZTNESiteStudioSafeV5.openTab('publish');assert.equal(w.IRGEZTNESiteStudioSafeV5.readState().site.publishSettings.selectedProvider,'manual');
 const siteState={sites:[{state:{pages:[{id:'home'},{id:'about'}]}},{state:{pages:[{id:'second'}]}}]};modules.set('webstudio.siteManager.v1',siteState);
 w.eval(fs.readFileSync(path.join(root,'src/modules/workspace-backup/workspace-backup-v0.js'),'utf8'));assert.equal(w.NSWorkspaceBackup.getStats().sites,2);assert.equal(w.NSWorkspaceBackup.getStats().pages,3);
 console.log('PASS: actual Web Studio DOM handlers, four providers, SFTP/FTPS, legacy FTP selection fallback, starter removal, Account dispatch+overlay close, language/theme, Home/close, durable backup counters (DOM harness; visual layout not tested)');
}finally{for(const observer of observers)observer.disconnect();w.close();}
