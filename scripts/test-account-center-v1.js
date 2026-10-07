const fs=require('fs'); const path=require('path'); const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function ok(c,m){if(!c){console.error('FAIL:',m);process.exitCode=1;}else console.log('PASS:',m);}
const a=read('src/connected/connected-account-v044.js');
const css=read('styles.css');
ok(a.includes('account-v24__rail'),'Account Center has vertical v24 navigation rail');
ok(
  ['profile','identity','security','recovery','services','info'].every(view => a.includes("navButton('" + view + "'")) &&
    !a.includes("navButton('overview'"),
  'Account Center has exactly Profile/Identification/Security/Recovery/Services/Details views'
);
ok(a.includes('data-account-surface-action="desktop-connect"'),'local mode connects through native desktop authorization');
ok(a.includes('data-account-surface-action="desktop-complete"'),'pending browser authorization can be completed in Workspace');
ok(a.includes('data-account-surface-action="browser-account"'),'sensitive Account management is handed to browser surface');
ok(a.includes('Device Key stays local') || a.includes('Device Key хранится локально'),'device-key locality is visible');
ok(a.includes('chat:access') && a.includes('workshop:access'),'service scopes are visible and separate');
ok(!/supabase/i.test(a),'Account Center has no legacy Supabase runtime');
ok(!/current_password|new_password|confirm_password|remember_login/.test(a),'Account Center has no legacy email/password form handling');
ok(css.includes('IRGEZTNE Account v24 — vertical native Workspace surface'),'v24 Account styles are present');
ok(/readability \+ desktop composition R1[\s\S]*\.account-v24\s*\{[\s\S]*width:\s*min\(1700px/.test(css),'desktop Account layout uses the final readable wide surface');
ok(!a.includes('data-account-rail-toggle') && !a.includes('accountRailCollapsed') && css.includes('@media (max-width: 560px)'),'Account Center keeps a fixed desktop rail and responsive narrow-window layout');
if(process.exitCode) process.exit(process.exitCode); else console.log('ACCOUNT CENTER v24 STATIC PASS');
