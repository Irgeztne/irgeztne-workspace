'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {pathToFileURL}=require('node:url');const Database=require('better-sqlite3');const {createStorageCore}=require('../src/storage/storage-core-main');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'irgeztne-cleanup-'));let core;
const idb=[{name:'irgeztne-workshop-bytes-v1',stores:[{name:'files',records:[{blobKey:'test',bytes:{__binary:'base64',size:4,data:'VEVTVA=='}}]}]},{name:'irgeztne-webstudio-template-site-snapshots-v1',stores:[]}];
try{
 core=createStorageCore({dataDir:root});
 const img=path.join(root,'webstudio-media','first','image.png');fs.mkdirSync(path.dirname(img),{recursive:true});fs.writeFileSync(img,'RETAINED-SITE-ASSET');
 const stale=path.join(root,'webstudio-media','second','test.png');fs.mkdirSync(path.dirname(stale),{recursive:true});fs.writeFileSync(stale,'REMOVED-SITE-ASSET');
 fs.writeFileSync(path.join(root,'notes.json'),'[{"text":"OLD LEGACY NOTE"}]');
 const accountFile=path.join(root,'account-secure-v1.json');fs.writeFileSync(accountFile,'ACCOUNT-SECURE-SENTINEL');
 const identityFile=path.join(root,'identity-secure-v1.json');fs.writeFileSync(identityFile,'IDENTITY-SECURE-SENTINEL');
 const manager={version:1,activeSiteId:'second',sites:[{id:'first',name:'Landing',state:{site:{name:'Landing'},pages:[{id:'home',content:'RETAINED TEXT <img src="'+pathToFileURL(img).href+'">'}]}},{id:'second',name:'aaa',state:{site:{name:'aaa'},pages:[{id:'test',content:'REMOVE TEXT <img src="'+pathToFileURL(stale).href+'">'}]}}]};
 core.setModuleState('webstudio.siteManager.v1',manager);
 core.setModuleState('workspace.tasks.v1',{tasks:[{id:'oldtask'}]});core.setModuleState('office.documents.v1',{items:[{id:'oldDoc'}]});core.setModuleState('workspace.workshop.installed.v1',{items:[{id:'oldPkg'}]});
 core.setModuleState('account.session.v1',{secret:'MASTER-SENTINEL'});core.setModuleState('chat.session.v1',{secret:'CHAT-SENTINEL'});
 const cache={'irgeztne.documents.v1':JSON.stringify({items:[{id:'STALE-CACHE'}]}),'irgeztne.webStudioSites.v1':JSON.stringify(manager),'irgeztne.account.v1':'MASTER-SENTINEL','nsbrowser.v8.language':'ru'};
 assert.throws(()=>core.cleanTestWorkspace(cache,[]),/Both Workshop/);assert.equal(core.getModuleState('webstudio.siteManager.v1').sites.length,2);
 const out=core.cleanTestWorkspace(cache,idb);assert(out.ok);assert.equal(out.sites,0);assert.equal(core.getModuleState('webstudio.siteManager.v1').sites.length,0);
 assert.equal(fs.existsSync(stale),false);assert.equal(fs.existsSync(img),false);assert.equal(fs.existsSync(path.join(root,'notes.json')),false);
 assert.equal(fs.readFileSync(accountFile,'utf8'),'ACCOUNT-SECURE-SENTINEL');assert.equal(fs.readFileSync(identityFile,'utf8'),'IDENTITY-SECURE-SENTINEL');
 assert.equal(core.getModuleState('account.session.v1').secret,'MASTER-SENTINEL');assert.equal(core.getModuleState('chat.session.v1').secret,'CHAT-SENTINEL');
 assert.equal(core.getModuleState('workspace.tasks.v1').tasks.length,0);assert.equal(core.getModuleState('office.documents.v1').items.length,0);assert.equal(core.getModuleState('workspace.workshop.installed.v1').items.length,0);
 assert.equal(JSON.parse(out.storage['irgeztne.documents.v1']).items.length,0);assert.equal(out.storage['nsbrowser.v8.language'],'ru');assert(!out.removeLocalKeys.includes('irgeztne.account.v1'));
 const saved=JSON.parse(fs.readFileSync(path.join(out.backupDir,'workspace.json'),'utf8'));assert.equal(saved.tables.module_state.find(r=>r.module_id==='webstudio.siteManager.v1')!=null,true);assert.equal(saved.assets.length,3);assert(!JSON.stringify(saved).includes('MASTER-SENTINEL'));assert(!JSON.stringify(saved).includes('CHAT-SENTINEL'));
 assert.equal(JSON.parse(fs.readFileSync(path.join(out.backupDir,'workshop-indexeddb.json'),'utf8'))[0].stores[0].records[0].bytes.data,'VEVTVA==');
 assert.equal(fs.readFileSync(path.join(out.backupDir,'removed','webstudio-media','second','test.png'),'utf8'),'REMOVED-SITE-ASSET');
 core.close();core=createStorageCore({dataDir:root});const next=core.getModuleState('webstudio.siteManager.v1');assert.equal(next.sites.length,0);assert.equal(next.activeSiteId,'');
 // Real database failure after assets have moved must restore the original files/state.
 fs.writeFileSync(stale,'ROLLBACK-SENTINEL');const db=new Database(path.join(root,'irgeztne-workspace.db'));db.exec("CREATE TRIGGER fail_cleanup BEFORE INSERT ON module_state WHEN NEW.module_id='workspace.tasks.v1' BEGIN SELECT RAISE(ABORT,'fixture rollback'); END;");
 assert.throws(()=>core.cleanTestWorkspace({},idb),/fixture rollback/);assert.equal(fs.readFileSync(stale,'utf8'),'ROLLBACK-SENTINEL');assert.equal(core.getModuleState('webstudio.siteManager.v1').sites.length,0);db.close();
 console.log('PASS: actual SQLite cleanup, zero sites/assets and all removed site bytes archived, empty modules/cache mirrors, physical obsolete files archived, Account/Identity/Chat untouched, IndexedDB byte backup, restart, rollback after SQL failure');
}finally{if(core)core.close();fs.rmSync(root,{recursive:true,force:true});}
