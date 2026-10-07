"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const studioPath = path.join(root, "src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js");
const source = fs.readFileSync(studioPath, "utf8");
assert.match(source, /IRGEZTNE_OFFICIAL_FOUR_CANON_V098A/);
assert.match(source, /renderOfficialFourV098A/);
assert.match(source, /officialFourExtraEntriesV098A/);
const firstIife = source.split("// 1.0.0 v5 exit/back safe")[0];
function fakeCanvas(){return {getContext(){return {clearRect(){},beginPath(){},moveTo(){},arcTo(){},closePath(){},fill(){},arc(){},fillText(){},set fillStyle(v){},set textAlign(v){},set textBaseline(v){},set font(v){}}},toDataURL(){return "data:image/png;base64,iVBORw0KGgo="}}}
function hooks(lang){
 const storage=new Map([["irgeztne.webStudio.lang.v1",lang]]);
 const document={readyState:"loading",documentElement:{getAttribute:n=>n==="lang"?lang:""},body:{innerText:""},addEventListener(){},createElement(tag){if(tag==="template")return {innerHTML:"",content:{querySelectorAll:()=>[]}};if(tag==="canvas")return fakeCanvas();return {}}};
 const window={__IRGEZTNE_WEBSTUDIO_TEST__:true,addEventListener(){},setTimeout,clearTimeout};
 const context={window,document,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))},console:{log(){},warn(){},error(){}},URL,Blob,atob,btoa,setTimeout,clearTimeout,setInterval:()=>0,clearInterval(){},MutationObserver:class{observe(){} disconnect(){}}};
 window.window=window;window.document=document;window.localStorage=context.localStorage;
 vm.runInNewContext(firstIife,context,{filename:studioPath});
 return window.__IRGEZTNE_WEBSTUDIO_TEST_HOOKS__;
}
const expected={
 "business-product":{pages:["about.html","contacts.html","index.html","services.html"],marker:/Meridian/,assets:3},
 "blog-news":{pages:["about.html","article-clear-product-pages.html","article-editorial-rhythm.html","article-modern-web-products.html","article-prepublish-check.html","article-publishing-tools.html","article-wide-layouts.html","articles.html","index.html","topics.html"],marker:/Northline Journal/,assets:6,rss:true},
 "studio-portfolio":{pages:["about.html","contact.html","index.html","works.html"],marker:/Aster Works/,assets:5},
 "agency-studio":{pages:["cases.html","contact.html","index.html","process.html","services.html"],marker:/Vector Atelier/,assets:4}
};
for(const lang of ["ru","en"]){
 const h=hooks(lang);
 for(const [id,info] of Object.entries(expected)){
   const state=h.templatePreviewState(id);
   const html=h.templatePreviewHtml(id);
   const payload=h.templatePreviewPayload(id);
   assert.match(html,new RegExp(`<html[^>]+lang=["']${lang}["']`),`${id}/${lang}: fixed language`);
   assert.match(html,info.marker,`${id}/${lang}: canonical brand`);
   assert.doesNotMatch(html,/data-lang-toggle|class=["'][^"']*lang-toggle/,`${id}/${lang}: no runtime language switch`);
   assert.match(html,/var key="irgeztne\.site\.theme"/,`${id}/${lang}: first-frame theme boot`);
   const pages=Object.keys(payload.package).filter(n=>/\.html$/.test(n)).sort();
   assert.deepEqual(pages,info.pages,`${id}/${lang}: page set`);
   const assetCount=Object.keys(payload.package).filter(n=>n.startsWith("assets/template/")).length;
   assert.equal(assetCount,info.assets,`${id}/${lang}: asset count`);
   if(info.rss) assert.ok(payload.package["rss.xml"],`${id}/${lang}: RSS included`);
 }
}
for(const [id,sp] of Object.entries({"business-product":"business-product","blog-news":"blog-news","studio-portfolio":"portfolio-personal","agency-studio":"agency-studio"})){
 const dir=path.join(root,"template-lab",sp);
 assert.ok(fs.existsSync(path.join(dir,"RU","index.html")),`${id}: RU source`);
 assert.ok(fs.existsSync(path.join(dir,"EN","index.html")),`${id}: EN source`);
}
console.log("PASS: Official Four V098A integration contract verified");
