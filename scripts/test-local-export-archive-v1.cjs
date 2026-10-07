'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const vm=require('node:vm');const {spawnSync}=require('node:child_process');const {JSDOM}=require('jsdom');
(async()=>{
 const root=path.resolve(__dirname,'..');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'irgeztne-local-export-'));
 const dom=new JSDOM('<!doctype html><html lang="en"><body></body></html>',{url:'http://localhost/',runScripts:'outside-only'});const w=dom.window;const observers=[];const Obs=w.MutationObserver;w.MutationObserver=class extends Obs{constructor(f){super(f);observers.push(this)}};
 try{
  w.__IRGEZTNE_WEBSTUDIO_TEST__=true;w.console={log(){},warn(){},error(){}};
  w.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},clearRect(){},fillText(){},beginPath(){},arc(){},fill(){},measureText(){return {width:10}}});w.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/png;base64,iVBORw0KGgo=';
  w.eval(fs.readFileSync(path.join(root,'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js'),'utf8').split('// 1.0.0 v5 exit/back safe')[0]);
  const hooks=w.__IRGEZTNE_WEBSTUDIO_TEST_HOOKS__;const state=hooks.templatePreviewState('project-landing');
  const mediaDir=path.join(dir,'webstudio-media');fs.mkdirSync(mediaDir);const image=path.join(mediaDir,'marker.png');const bytes=Buffer.from('LOCAL-EXPORT-IMAGE-BYTES');fs.writeFileSync(image,bytes);
  state.pages=[{id:'home',slug:'index',title:'Home',pageName:'Home',status:'published',bodyHtml:'<p>EXPORT-HOME-MARKER</p><img src="assets/media/image/marker.png">',inMenu:true,order:0},{id:'about',slug:'about',title:'About',pageName:'About',status:'published',bodyHtml:'<p>EXPORT-ABOUT-MARKER</p>',inMenu:true,order:1},{id:'contact',slug:'contact',title:'Contact',pageName:'Contact',status:'published',bodyHtml:'<p>EXPORT-CONTACT-MARKER</p>',inMenu:true,order:2}];
  state.activePageId='home';state.site.mediaAssets=[{id:'marker',kind:'image',publicPath:'assets/media/image/marker.png',sourcePath:image,mimeType:'image/png'}];
  const payload=hooks.createZipPayload(state,state.pages[0]);
  const main=fs.readFileSync(path.join(root,'main.js'),'utf8');
  const sanitize=main.slice(main.indexOf('function sanitizePlainText('),main.indexOf('\nfunction ',main.indexOf('function sanitizePlainText(')+1));
  const zipCode=main.slice(main.indexOf('const CRC32_TABLE'),main.indexOf('function netlifyDeployMessage'));
  const ctx={fs,fsp:fs.promises,path,Buffer,Uint32Array,console,Date,__dirname:root,WEBSTUDIO_MEDIA_DIR:mediaDir,ensureDir:d=>fs.mkdirSync(d,{recursive:true}),shell:{showItemInFolder(){}}};
  vm.runInNewContext(sanitize+'\n'+zipCode+'\nthis.writeZip=writeExportZipPackage;',ctx);
  const file=path.join(dir,'site.zip');const result=await ctx.writeZip(payload,file);assert.equal(result.ok,true);
  const inspected=spawnSync('python3',['-c',`import zipfile,sys\nwith zipfile.ZipFile(sys.argv[1]) as z:\n assert z.testzip() is None\n assert b'EXPORT-HOME-MARKER' in z.read('index.html')\n assert b'EXPORT-ABOUT-MARKER' in z.read('about.html')\n assert b'EXPORT-CONTACT-MARKER' in z.read('contact.html')\n assert z.read('assets/media/image/marker.png') == b'LOCAL-EXPORT-IMAGE-BYTES'\n print('PASS: actual main-process ZIP writer, three generated pages, local physical asset, ZIP CRC inspection; native save-dialog not tested')`,file],{encoding:'utf8'});
  assert.equal(inspected.status,0,inspected.stderr);console.log(inspected.stdout.trim());
 }finally{for(const o of observers)o.disconnect();w.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
