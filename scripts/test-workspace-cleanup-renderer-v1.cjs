'use strict';
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const {JSDOM}=require('jsdom');const {indexedDB}=require('fake-indexeddb');
const root=path.resolve(__dirname,'..');const dom=new JSDOM(fs.readFileSync(path.join(root,'maintenance-cleanup.html'),'utf8'),{url:'http://localhost/',runScripts:'outside-only'});const w=dom.window;w.indexedDB=indexedDB;
const names=['irgeztne-workshop-bytes-v1','irgeztne-webstudio-template-site-snapshots-v1'];
function open(name){return new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore('records',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function put(name,records){const db=await open(name);await new Promise((resolve,reject)=>{const t=db.transaction('records','readwrite');for(const r of records)t.objectStore('records').put(r);t.oncomplete=resolve;t.onerror=()=>reject(t.error);});db.close();}
async function rows(name){const db=await open(name);try{return await new Promise((resolve,reject)=>{const r=db.transaction('records','readonly').objectStore('records').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}}
(async()=>{try{
 await put(names[0],[{id:'package',bytes:new w.Uint8Array([84,69,83,84]).buffer}]);await put(names[1],[{id:'retained',snapshotId:'retained-snapshot'},{id:'obsolete',snapshotId:'old-snapshot'}]);
 w.localStorage.setItem('irgeztne.documents.v1',JSON.stringify({items:[{id:'old'}]}));w.localStorage.setItem('account.session','ACCOUNT-SENTINEL');w.localStorage.setItem('irgeztne-workshop-installed-v1','[{"id":"test"}]');
 let calls=0;w.nsAPI={workspaceTestCleanup:async payload=>{
  calls++;assert(!Object.keys(payload.storage).includes('account.session'));assert.equal(payload.indexedDB[0].stores[0].records[0].bytes.data,'VEVTVA==');
  return {ok:true,siteName:'Landing',backupDir:'/fixture/backup',removeLocalKeys:['irgeztne.documents.v1','irgeztne-workshop-installed-v1'],storage:{'irgeztne.documents.v1':'{"items":[]}','irgeztne-workshop-installed-v1':'[]'},keepSnapshotIds:[]};
 }};
 w.eval(fs.readFileSync(path.join(root,'src/storage/workspace-cleanup-renderer.js'),'utf8'));w.document.getElementById('clean').click();
 for(let n=0;n<150&&!w.document.getElementById('result').textContent.startsWith('Готово.');n++)await new Promise(r=>setTimeout(r,5));
 assert.match(w.document.getElementById('result').textContent,/Готово\./);assert.equal(calls,1);assert.equal(JSON.parse(w.localStorage.getItem('irgeztne.documents.v1')).items.length,0);assert.equal(w.localStorage.getItem('account.session'),'ACCOUNT-SENTINEL');assert.equal((await rows(names[0])).length,0);const snapshots=await rows(names[1]);assert.equal(snapshots.length,0);
 console.log('PASS: actual isolated renderer, ArrayBuffer backup, known-key IPC only, stale cache replacement, Account cache untouched, package bytes cleared, all site snapshots cleared (jsdom + fake IndexedDB; not Electron E2E)');
}finally{w.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
