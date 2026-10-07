'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/__closure') {res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="en"><body></body></html>');return;}
  const file=path.resolve(root,'.'+pathname); if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.statusCode=404;res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
  browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:800}});
  const origin='http://127.0.0.1:'+server.address().port;
  await page.goto(origin+'/__closure');
  await page.evaluate(()=>{window.accountOpened=0;window.IRGEZTNEConnected={openAccountSurface(){window.accountOpened++}};const modules=new Map();window.nsAPI={storageGetModuleStateSync(k,f){return modules.has(k)?structuredClone(modules.get(k)):f},storageSetModuleStateSync(k,v){modules.set(k,structuredClone(v));return {ok:true}},storageSecretHasSync(){return false},storageSecretPreviewSync(){return ''}};});
  const src=fs.readFileSync(path.join(root,'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js'),'utf8').split('// 1.0.0 v5 exit/back safe')[0];
  await page.addScriptTag({content:src});
  await page.evaluate(()=>window.IRGEZTNESiteStudioSafeV5.openTab('publish'));
  const cards=page.locator('.ir-site-studio-v5-publish-provider-grid [data-v5-provider]');
  assert.deepEqual(await cards.locator('strong').allTextContents(),['Local Export','Netlify','Cloudflare Pages','Own Hosting']);
  assert.equal(await page.locator('[data-v5-action="publish-download-starter-zip"]').count(),0);
  await page.locator('[data-v5-provider="sftp"]').first().click();
  assert.equal(await page.locator('[data-v5-provider="ftps"]').count(),1);
  assert.equal(await page.locator('[data-v5-provider="ftp"]').count(),0);
  const lang=page.locator('[data-v5-action="toggle-studio-lang"]');await lang.click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('irgeztne.webStudio.lang.v1')),'ru');
  await page.locator('[data-v5-action="toggle-studio-theme"]').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('irgeztne.webStudio.theme.v1')),'light');
  await page.locator('[data-v5-action="open-account-release-r1"]').click();
  assert.equal(await page.evaluate(()=>window.accountOpened),1);
  assert.equal(await page.locator('.ir-site-studio-v5-overlay.is-open').count(),0);
  await page.evaluate(()=>window.IRGEZTNESiteStudioSafeV5.openTab('sites'));
  await page.locator('[data-v5-action="exit-studio"], [data-v5-action="close"], [data-v5-action="back-editor"]').first().click();
  assert.equal(await page.locator('.ir-site-studio-v5-overlay.is-open').count(),0);
  await page.goto(origin+'/src/modules/editor-workbench/editor-workbench.html');
  await page.evaluate(()=>window.postMessage({source:'irgeztne-webstudio-v084b',type:'init',pageId:'closure',pageLabel:'Closure',lang:'en',html:'<section id="marker"><p>MARKER</p></section><section><p>SECOND</p></section>'},'*'));
  await page.locator('#ewbEditor #marker').waitFor();
  assert.equal(await page.locator('#ewbBlockHandle').isVisible(),false);
  await page.locator('#marker').hover();assert.equal(await page.locator('#ewbBlockHandle').isVisible(),true);
  await page.mouse.move(2,2);await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
  await page.waitForTimeout(60);assert.equal(await page.locator('#ewbBlockHandle').isVisible(),false);
  await page.locator('#marker').hover();assert.equal(await page.locator('#ewbBlockHandle').isVisible(),true);
  await page.evaluate(()=>window.postMessage({source:'irgeztne-webstudio-v084b',type:'host-viewport-r1w9h3',localTop:1000,localBottom:1500},'*'));
  await page.waitForTimeout(60);assert.equal(await page.locator('#ewbBlockHandle').isVisible(),false);
  console.log('PASS: rendered four-provider surface, SFTP/FTPS nesting, starter removal, Account routing, language/theme, Home/close, contextual block handle and host scroll clipping');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
