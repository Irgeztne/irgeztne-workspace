(()=>{
  const root=document.documentElement;
  const themeButton=document.querySelector('[data-theme-toggle]');
  const menuButton=document.querySelector('[data-menu-toggle]');
  const nav=document.querySelector('.main-nav');
  const key='vector-atelier-theme';
  const queryTheme=new URLSearchParams(location.search).get('theme');
  let saved=null;
  try{saved=localStorage.getItem(key)}catch(_error){}
  if(queryTheme==='dark'||queryTheme==='light')root.dataset.theme=queryTheme;
  else if(saved==='dark'||saved==='light')root.dataset.theme=saved;
  else if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)root.dataset.theme='dark';
  const syncOfflineLinks=()=>{
    if(location.protocol!=='file:')return;
    document.querySelectorAll('a[href$=".html"],a[href*=".html?"],a[href*=".html#"]').forEach(link=>{
      const raw=link.getAttribute('href');
      if(!raw)return;
      const target=new URL(raw,location.href);
      target.searchParams.set('theme',root.dataset.theme);
      const file=target.pathname.split('/').pop();
      link.setAttribute('href',file+target.search+target.hash);
    });
  };
  const syncTheme=()=>{
    const dark=root.dataset.theme==='dark';
    if(themeButton){
      themeButton.textContent=dark?'☀':'☾';
      themeButton.setAttribute('aria-label',dark?themeButton.dataset.lightLabel:themeButton.dataset.darkLabel);
    }
    syncOfflineLinks();
  };
  syncTheme();
  themeButton?.addEventListener('click',()=>{
    root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';
    try{localStorage.setItem(key,root.dataset.theme)}catch(_error){}
    syncTheme();
  });
  menuButton?.addEventListener('click',()=>{
    const open=nav.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded',String(open));
  });
  nav?.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{
    nav.classList.remove('is-open');
    menuButton?.setAttribute('aria-expanded','false');
  }));
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      nav?.classList.remove('is-open');
      menuButton?.setAttribute('aria-expanded','false');
    }
  });
})();
