'use strict';
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');const {pathToFileURL}=require('node:url');
const MAP={
 'nsbrowser:v8:source-library':'files.library.v1','ns.browser.v8.projects.v1':'workspace.projects.v1',
 'irgeztne.workspace.tasks.v1':'workspace.tasks.v1','ns.browser.v8.notes.v1':'workspace.notes.v1',
 'irgeztne.documents.v1':'office.documents.v1','nsbrowser:v8:knowledge-library':'workspace.knowledge.v1',
 'nsbrowser:v1:knowledge-packs':'workspace.knowledge-packs.v1','nsbrowser:v1:codehub-items':'workspace.codehub.v1',
 'ns.browser.v8.editor.v1':'workspace.editor.v1','ns.browser.v8.editor.v1.backup':'workspace.editor.backup.v1',
 'irgeztne.sitePages.v0':'workspace.site-pages.v1','irgeztne.siteСтраницы.v0':'workspace.site-pages.legacy.v1',
 'ns.browser.v8.site-profile.v1':'workspace.site-profile.v1','ns.browser.v8.vitrina.v1':'workspace.vitrina.v1',
 'irgeztne:map:v1:pins':'workspace.map.pins.v1','irgeztne-workshop-installed-v1':'workspace.workshop.installed.v1'
};
const IDB_NAMES=['irgeztne-workshop-bytes-v1','irgeztne-webstudio-template-site-snapshots-v1'];
function blank(id){
 if(id==='workspace.tasks.v1')return {persistenceVersion:1,meta:{version:1,lastUpdatedAt:new Date().toISOString()},tasks:[],events:[],relations:[],links:[],checklist:[],evidence:[],sessions:[]};
 if(id==='office.documents.v1')return {persistenceVersion:2,items:[],activeId:'',savedAt:new Date().toISOString()};
 if(id==='workspace.workshop.installed.v1')return {version:1,items:[]};
 return {persistenceVersion:1,items:[],pages:[],sites:[],packs:[],pins:[],drafts:[],activeId:'',meta:{version:1,lastUpdatedAt:new Date().toISOString()}};
}
function buildCleanBundle(before){
 const bundle=structuredClone(before);
 let row=bundle.tables.module_state.find(r=>r.module_id==='webstudio.siteManager.v1');
 const manager={version:1,activeSiteId:'',sites:[],updatedAt:new Date().toISOString()};
 const now=new Date().toISOString();
 bundle.tables.module_state=bundle.tables.module_state.filter(r=>r.module_id==='webstudio.siteManager.v1');
 if(!row){row={module_id:'webstudio.siteManager.v1',value:'',updated_at:now};bundle.tables.module_state.push(row);}
 row.value=JSON.stringify(manager);row.updated_at=now;
 for(const id of new Set(Object.values(MAP)))bundle.tables.module_state.push({module_id:id,value:JSON.stringify(blank(id)),updated_at:now});
 for(const table of ['webstudio_sites','webstudio_pages','workspace_file_blobs','workspace_files','workspace_file_refs'])bundle.tables[table]=[];
 bundle.assets=[];
 bundle.storage={};
 for(const k of ['irgeztne.workspace.identity.v0','nsbrowser.v8.language'])if(before.storage[k]!=null)bundle.storage[k]=before.storage[k];
 for(const [k,id] of Object.entries(MAP))bundle.storage[k]=JSON.stringify(blank(id));
 bundle.storage['irgeztne.webStudioSites.v1']=JSON.stringify(manager);

 bundle.storage['irgeztne-workshop-installed-v1']='[]';
 bundle.storage['irgeztne-workshop-installed-v1-meta']=JSON.stringify({persistenceVersion:1,updatedAt:now});
 return {bundle};
}
function cleanup(db,dataDir,backupApi,storage,indexedDB){
 const before=backupApi.exportBundle(db,dataDir,storage);
 if(!Array.isArray(indexedDB)||indexedDB.length!==2||!IDB_NAMES.every(n=>indexedDB.some(d=>d.name===n)))throw new Error('Both Workshop stores must be backed up before cleanup');
 let binaryBytes=0;
 function validateBytes(value){
  if(value&&typeof value==='object'){
   if(value.__binary==='base64'){
    if(typeof value.data!=='string'||!Number.isSafeInteger(value.size)||value.size<0||Buffer.from(value.data,'base64').length!==value.size)throw new Error('Invalid IndexedDB byte backup');
    binaryBytes+=value.size;
   }else for(const v of Object.values(value))validateBytes(v);
  }
 }
 for(const d of indexedDB){if(!IDB_NAMES.includes(d.name)||!Array.isArray(d.stores))throw new Error('Invalid Workshop byte backup');validateBytes(d);}
 if(binaryBytes+before.assets.reduce((s,a)=>s+a.size,0)>256*1024*1024)throw new Error('Cleanup backup exceeds 256 MiB. Nothing was cleaned.');
 const {bundle}=buildCleanBundle(before);backupApi.validate(bundle,db);
 const keepSnapshotIds=[];
 const dir=path.join(dataDir,'backups','before-test-cleanup-'+Date.now()+'-'+crypto.randomUUID());fs.mkdirSync(dir,{recursive:true,mode:0o700});
 const backupFile=path.join(dir,'workspace.json');const bytes=JSON.stringify(before);fs.writeFileSync(backupFile,bytes,{flag:'wx',mode:0o600});
 if(fs.readFileSync(backupFile,'utf8')!==bytes)throw new Error('Backup verification failed');
 const idbFile=path.join(dir,'workshop-indexeddb.json');const idbBytes=JSON.stringify(indexedDB);fs.writeFileSync(idbFile,idbBytes,{flag:'wx',mode:0o600});
 if(fs.readFileSync(idbFile,'utf8')!==idbBytes)throw new Error('Workshop byte backup verification failed');
 const keep=new Set(bundle.assets.map(a=>a.path));const moved=[];
 function inspect(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(entry.isSymbolicLink())throw new Error('Cleanup refuses symbolic links');if(entry.isDirectory())inspect(path.join(dir,entry.name));}}
 const exportsDir=path.join(dataDir,'exports');if(fs.existsSync(exportsDir)){if(fs.lstatSync(exportsDir).isSymbolicLink())throw new Error('Cleanup refuses exports symlink');inspect(exportsDir);}
 try{
  for(const a of before.assets)if(!keep.has(a.path)){
   const from=path.join(dataDir,a.path);const to=path.join(dir,'removed',a.path);fs.mkdirSync(path.dirname(to),{recursive:true});fs.renameSync(from,to);moved.push([from,to]);
  }
  if(fs.existsSync(exportsDir)){const to=path.join(dir,'removed','exports');fs.mkdirSync(path.dirname(to),{recursive:true});fs.renameSync(exportsDir,to);moved.push([exportsDir,to]);}
  const result=backupApi.restoreBundle(db,dataDir,bundle);
  return {...result,sites:0,backupDir:dir,removeLocalKeys:[...new Set([...Object.keys(before.storage),...Object.keys(MAP),'irgeztne-workshop-installed-v1-meta'])].filter(k=>!['irgeztne.workspace.identity.v0','nsbrowser.v8.language'].includes(k)),keepSnapshotIds};
 }catch(error){for(const [from,to] of moved.reverse()){fs.mkdirSync(path.dirname(from),{recursive:true});fs.renameSync(to,from);}throw error;}
}
module.exports={cleanup,buildCleanBundle};
