'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {JSDOM}=require('jsdom');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const html=fs.readFileSync(path.join(root,'src/modules/editor-workbench/editor-workbench.html'),'utf8');
 const dom=new JSDOM(html,{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;
 try{
  w.document.execCommand=()=>true;w.ResizeObserver=class{observe(){}disconnect(){}};
  const editor=w.document.getElementById('ewbEditor');editor.setAttribute('tabindex','0');
  editor.innerHTML='<section id="one"><p>ONE</p></section><section id="two"><p>TWO</p></section>';
  let blockTop=120;
  const rect=(top,height=200)=>({top,bottom:top+height,left:50,right:950,width:900,height});
  w.document.querySelector('.ewb-shell').getBoundingClientRect=()=>rect(0,2000);
  editor.getBoundingClientRect=()=>rect(110,1900);
  w.document.getElementById('one').getBoundingClientRect=()=>rect(blockTop);
  w.document.getElementById('two').getBoundingClientRect=()=>rect(340);
  let source=fs.readFileSync(path.join(root,'src/modules/editor-workbench/editor-workbench.js'),'utf8');const end=source.lastIndexOf('})();');assert(end>0);
  source=source.slice(0,end)+'window.__closurePosition=positionBlockChromeR1W9F6;\n'+source.slice(end);w.eval(source);
  const handle=w.document.getElementById('ewbBlockHandle');const menu=w.document.getElementById('ewbBlockMenu');const one=w.document.getElementById('one');
  assert.equal(handle.hidden,true);
  one.dispatchEvent(new w.MouseEvent('pointermove',{bubbles:true}));await new Promise(r=>w.requestAnimationFrame(r));assert.equal(handle.hidden,false);assert.equal(handle.style.top,'126px');
  editor.dispatchEvent(new w.MouseEvent('pointerleave',{relatedTarget:w.document.body}));w.__closurePosition();assert.equal(handle.hidden,true,'resize must not resurrect stale active hover');
  editor.focus();const range=w.document.createRange();range.selectNodeContents(one.querySelector('p'));w.getSelection().removeAllRanges();w.getSelection().addRange(range);w.__closurePosition();assert.equal(handle.hidden,false,'focused selection retains context actions');
  blockTop=30;w.__closurePosition();assert.equal(handle.hidden,true,'offscreen block is hidden instead of clamped');
  blockTop=120;w.__closurePosition();assert.equal(handle.hidden,false);handle.click();assert.equal(menu.hidden,false,'menu actions remain available');
  w.dispatchEvent(new w.MessageEvent('message',{source:w,data:{source:'irgeztne-webstudio-v084b',type:'host-viewport-r1w9h3',localTop:1000,localBottom:1500}}));await new Promise(r=>w.requestAnimationFrame(r));assert.equal(handle.hidden,true);assert.equal(menu.hidden,true);
  console.log('PASS: real block-handle code — hover/focus selection, stale hover, offscreen clipping, menu opening, parent viewport scroll (DOM geometry fixture, not visual E2E)');
 }finally{w.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
