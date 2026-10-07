#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const owner = path.join(root, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js');
const text = fs.readFileSync(owner, 'utf8');
function assert(ok, msg){ if(!ok){ console.error('FAIL:', msg); process.exit(1); } }
assert(text.includes('IRGEZTNE_BLOG_ARTICLE_ROUTES_V098H'), 'v098h marker missing');
assert(text.includes('migrateBlogArticleRoutesV098H(state);'), 'migration is not called');
assert(text.includes('inMenu: item.inMenu !== false'), 'detail pages may leak into main navigation');
const slugs = ['article-modern-web-products','article-publishing-tools','article-clear-product-pages','article-prepublish-check','article-editorial-rhythm','article-wide-layouts'];
for (const slug of slugs) {
  assert(text.includes(slug), `embedded route missing: ${slug}`);
  for (const lang of ['RU','EN']) {
    const file = path.join(root, 'template-lab/blog-news', lang, slug + '.html');
    assert(fs.existsSync(file), `source detail page missing: ${lang}/${slug}.html`);
    const html = fs.readFileSync(file, 'utf8');
    assert(/<h1>/.test(html), `detail h1 missing: ${lang}/${slug}`);
    assert((html.match(/<p/g) || []).length >= 6, `detail content too thin: ${lang}/${slug}`);
    assert(html.includes('articles.html'), `back route missing: ${lang}/${slug}`);
  }
}
for (const lang of ['RU','EN']) {
  const archive = fs.readFileSync(path.join(root,'template-lab/blog-news',lang,'articles.html'),'utf8');
  assert(!/href=["']#article-\d+["']/.test(archive), `${lang} archive still uses fake article anchors`);
  const rss = fs.readFileSync(path.join(root,'template-lab/blog-news',lang,'rss.xml'),'utf8');
  assert(!rss.includes('articles.html#article-1'), `${lang} RSS still points to archive anchor`);
}
assert(text.includes('IRGEZTNE_MEDIA_RENDER_PARITY_V098G'), 'v098g media parity marker lost');
assert(text.includes('IRGEZTNE_OFFICIAL_FOUR_BRAND_SLOT_V098F'), 'v098f brand marker lost');
console.log('PASS: Web Studio V098H Blog article routes verified');
