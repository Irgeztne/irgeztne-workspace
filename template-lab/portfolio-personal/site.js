(()=>{
  const root=document.documentElement;
  const themeButton=document.querySelector('[data-theme-toggle]');
  const menuButton=document.querySelector('[data-menu-toggle]');
  const nav=document.querySelector('[data-main-nav]');
  const key='aster-works-theme';
  function preferredTheme(){
    const queryTheme=new URLSearchParams(location.search).get('theme');
    if(queryTheme==='dark'||queryTheme==='light')return queryTheme;
    try{
      const stored=localStorage.getItem(key);
      if(stored==='dark'||stored==='light')return stored;
    }catch(_error){}
    return window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
  }
  function syncOfflineLinks(theme){
    if(location.protocol!=='file:')return;
    document.querySelectorAll('a[href$=".html"],a[href*=".html?"],a[href*=".html#"]').forEach(link=>{
      const raw=link.getAttribute('href');
      if(!raw)return;
      const target=new URL(raw,location.href);
      target.searchParams.set('theme',theme);
      const file=target.pathname.split('/').pop();
      link.setAttribute('href',file+target.search+target.hash);
    });
  }
  function setTheme(theme,persist=true){
    root.dataset.theme=theme;
    if(themeButton){
      themeButton.textContent=theme==='dark'?'☀':'☾';
      themeButton.setAttribute('aria-pressed',String(theme==='dark'));
      themeButton.setAttribute('aria-label',theme==='dark'?themeButton.dataset.labelLight:themeButton.dataset.labelDark);
    }
    if(persist){
      try{localStorage.setItem(key,theme)}catch(_error){}
    }
    syncOfflineLinks(theme);
  }
  setTheme(preferredTheme(),false);
  themeButton?.addEventListener('click',()=>{
    const next=root.dataset.theme==='dark'?'light':'dark';
    setTheme(next);
  });
  menuButton?.addEventListener('click',()=>{
    const open=nav?.dataset.open!=='true';
    if(nav)nav.dataset.open=String(open);
    menuButton.setAttribute('aria-expanded',String(open));
  });
  nav?.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{
    nav.dataset.open='false';
    menuButton?.setAttribute('aria-expanded','false');
  }));
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&nav){
      nav.dataset.open='false';
      menuButton?.setAttribute('aria-expanded','false');
    }
  });
})();
