(function(){'use strict';
 const names=['irgeztne-workshop-bytes-v1','irgeztne-webstudio-template-site-snapshots-v1'];
 let encodedBytes=0;
 async function encode(v){
  if(v instanceof Blob)v=await v.arrayBuffer();
  const isBuffer=Object.prototype.toString.call(v)==='[object ArrayBuffer]';
  if(isBuffer||ArrayBuffer.isView(v)){
   const b=isBuffer?new Uint8Array(v):new Uint8Array(v.buffer,v.byteOffset,v.byteLength);encodedBytes+=b.length;if(encodedBytes>256*1024*1024)throw new Error('Хранилище Мастерской превышает 256 MiB. Очистка не выполнена.');let raw='';
   for(let i=0;i<b.length;i+=32768)raw+=String.fromCharCode(...b.subarray(i,i+32768));
   return {__binary:'base64',size:b.length,data:btoa(raw)};
  }
  if(Array.isArray(v))return Promise.all(v.map(encode));
  if(v&&typeof v==='object'){const out={};for(const [k,x]of Object.entries(v))out[k]=await encode(x);return out;}
  return v;
 }
 function open(name){return new Promise((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('Хранилище занято другим окном. Полностью закройте IRGEZTNE и повторите запуск.'));});}
 async function snapshot(name){const db=await open(name);try{
  const stores=[];for(const name of db.objectStoreNames){
   const raw=await new Promise((resolve,reject)=>{const tx=db.transaction(name,'readonly');const req=tx.objectStore(name).getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
   stores.push({name,records:await encode(raw)});
  }return {name,stores};
 }finally{db.close();}}
 async function prune(name,keep){const db=await open(name);try{
  for(const storeName of db.objectStoreNames)await new Promise((resolve,reject)=>{
   const tx=db.transaction(storeName,'readwrite');const store=tx.objectStore(storeName);
   if(name===names[0])store.clear();else{
    const r=store.openCursor();r.onsuccess=()=>{const c=r.result;if(!c)return;if(!keep.includes(String(c.value.snapshotId||'')))c.delete();c.continue();};
   }tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
 }finally{db.close();}}
 const button=document.getElementById('clean');const status=document.getElementById('result');
 button.addEventListener('click',async()=>{button.disabled=true;let completed=null;
  try{
   status.textContent='Сохраняем рабочие данные…';
   // Only explicit workspace keys cross IPC; service domains are excluded in Main too.
   const keys=['irgeztne.workspace.identity.v0','nsbrowser.v8.language','nsbrowser:v8:source-library','ns.browser.v8.projects.v1','irgeztne.workspace.tasks.v1','ns.browser.v8.notes.v1','irgeztne.documents.v1','irgeztne.sitePages.v0','irgeztne.webStudioSites.v1','irgeztne.editorSiteStudioSafe.v4','irgeztne:map:v1:pins','ns.browser.v8.editor.v1','ns.browser.v8.editor.v1.backup','nsbrowser:v1:codehub-items','nsbrowser:v1:knowledge-packs','nsbrowser:v8:knowledge-library','ns.browser.v8.tools.v1','ns.browser.v8.vitrina.v1','ns.browser.v8.site-profile.v1','nsbrowser.v8.bookmarks','nsbrowser.v8.browser.source','irgeztne-workshop-installed-v1'];
   const storage={};for(const k of keys){const v=localStorage.getItem(k);if(v!==null)storage[k]=v;}
   const indexedDBBackup=[];for(const n of names)indexedDBBackup.push(await snapshot(n));
   completed=await window.nsAPI.workspaceTestCleanup({storage,indexedDB:indexedDBBackup});
   if(!completed.ok)throw new Error(completed.error||'Очистка не выполнена');
   for(const k of completed.removeLocalKeys)localStorage.removeItem(k);
   for(const [k,v]of Object.entries(completed.storage))localStorage.setItem(k,v);
   for(const n of names)await prune(n,completed.keepSnapshotIds);
   status.textContent='Готово. Сайтов: 0. Тестовые рабочие данные очищены.\nКопия данных: '+completed.backupDir+'\n\nЗакройте это окно и запустите IRGEZTNE обычным способом (без переменной очистки). Account сохранён. История Chat и файлы вне управляемого хранилища не изменялись.';
  }catch(error){status.textContent='Очистка не завершена: '+error.message+(completed?'\nКопия данных: '+completed.backupDir:'\nРабочие модули не запускались. Не открывайте их до устранения ошибки.');}
 });
})();
