'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const studioPath = path.join(root, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js');
const fullSource = fs.readFileSync(studioPath, 'utf8');
const firstIife = fullSource.split('// 1.0.0 v5 exit/back safe')[0];
const storage = new Map([['irgeztne.webStudio.lang.v1', 'en']]);
const documentElement = { getAttribute: (name) => name === 'lang' ? 'en' : '' };
const document = {
  readyState: 'loading', documentElement, body: { innerText: '' }, addEventListener() {},
  createElement(tag) {
    if (tag === 'template') return { innerHTML: '', content: { querySelectorAll: () => [] } };
    if (tag === 'canvas') return { getContext: () => null };
    return {};
  }
};
const window = { __IRGEZTNE_WEBSTUDIO_TEST__: true, addEventListener() {}, setTimeout, clearTimeout };
const context = {
  window, document,
  localStorage: {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value))
  },
  console: { log() {}, warn() {}, error() {} }, URL, Blob, setTimeout, clearTimeout,
  setInterval: () => 0, clearInterval() {},
  MutationObserver: class { observe() {} disconnect() {} }
};
window.window = window;
window.document = document;
window.localStorage = context.localStorage;
vm.runInNewContext(firstIife, context, { filename: studioPath });

const hooks = window.__IRGEZTNE_WEBSTUDIO_TEST_HOOKS__;
assert.ok(hooks, 'Web Studio public-page test hooks are available');
const templateIds = ['project-landing', 'business-product', 'blog-news', 'documentation-wide', 'studio-portfolio', 'agency-studio'];

function page(id, slug, name, status, extra = {}) {
  const result = {
    id, slug, pageName: name, title: name, headline: name, summary: `${name} summary`,
    bodyHtml: `<p>${name} body</p>`, inMenu: false, inFooter: false,
    parentId: '', order: 0, ...extra
  };
  if (status !== undefined) result.status = status;
  return result;
}

function stateFor(templateId) {
  const home = page('home', 'index', 'Home', 'published', { inMenu: true, order: 0 });
  const published = page('published', 'published-custom', 'Published Custom', 'published', { inMenu: true, order: 1 });
  const missingStatus = page('missing-status', 'missing-status', 'Missing Status', undefined, { inMenu: true, order: 2 });
  const legacyArchived = page('legacy-archived', 'legacy-archived', 'Legacy Archived', 'archived', { inMenu: true, order: 3 });
  const draftTop = page('draft-top', 'draft-top', 'Draft Top', 'draft', { inMenu: true, order: 4 });
  const publishedChild = page('published-child', 'published-child', 'Published Child', 'published', { inMenu: true, parentId: published.id, order: 0 });
  const draftChild = page('draft-child', 'draft-child', 'Draft Child', 'draft', { inMenu: true, parentId: published.id, order: 1 });
  const publishedFooter = page('published-footer', 'published-footer', 'Published Footer', 'published', { inFooter: true, footerGroup: 'legal', order: 5 });
  const draftFooter = page('draft-footer', 'draft-footer', 'Draft Footer', 'draft', { inFooter: true, footerGroup: 'legal', order: 6 });
  return {
    site: {
      name: `Contract ${templateId}`, tagline: 'Contract test', activeTemplate: templateId, template: templateId,
      accentColor: '#2f7be6', menuColor: '#2f7be6', buttonColor: '#2f7be6', backgroundColor: '#ffffff', textColor: '#101827',
      logoLetters: 'IR', logoBackgroundColor: '#2f7be6', logoTextColor: '#ffffff', faviconLetters: 'IR', faviconBackgroundColor: '#2f7be6', faviconTextColor: '#ffffff',
      siteSettings: {}, publishSettings: {}
    },
    pages: [home, published, missingStatus, legacyArchived, draftTop, publishedChild, draftChild, publishedFooter, draftFooter],
    activePageId: home.id, menuGroups: []
  };
}

function assertPublicPayload(payload, templateId, label) {
  const files = payload.package;
  for (const name of ['published-custom.html', 'missing-status.html', 'published-child.html', 'published-footer.html']) {
    assert.ok(files[name], `${templateId}/${label}: ${name} is public`);
  }
  for (const name of ['legacy-archived.html', 'draft-top.html', 'draft-child.html', 'draft-footer.html']) {
    assert.ok(!files[name], `${templateId}/${label}: ${name} is not public`);
  }
  assert.doesNotMatch(files['sitemap.xml'], /legacy-archived|draft-(?:top|child|footer)/, `${templateId}/${label}: non-public pages are absent from sitemap`);
  assert.ok(files['favicon.svg'], `${templateId}/${label}: favicon asset is preserved`);
  assert.ok(files['site.webmanifest'], `${templateId}/${label}: favicon manifest is preserved`);
}

function testDocumentationRepairAndFaq() {
  const originalBody = '<div class="docs-home-v085a"><p data-preserve="yes">Preserve this content</p>' +
    '<div class="docs-faq-v085a"><details open=""><summary>First</summary><p>First answer</p></details>' +
    '<details data-keep="yes"><summary>Second</summary><p>Second answer</p></details>' +
    '<details><summary>Third</summary><p>Third answer</p></details></div></div>';
  const expectedBody = originalBody.replace('<details open="">', '<details>');
  const createdAt = '2026-07-22T08:28:04.258Z';
  const damagedHome = page('docs-home-id', 'getting-started-2', 'Начало', 'published', {
    type: 'home', pagePreset: 'landing', bodyHtml: originalBody, createdAt, updatedAt: createdAt, inMenu: true
  });
  const gettingStarted = page('getting-started-id', 'getting-started', 'Getting started', 'published', {
    type: 'page', pagePreset: 'blank', bodyHtml: '<p>Keep getting started</p>', order: 1, inMenu: true
  });
  const userArticle = page('user-article-id', 'novaya-stranica-sayta', 'Тестовая статья', 'published', {
    type: 'page', pagePreset: 'blank', bodyHtml: '<details open><summary>User detail</summary><p>User body</p></details>', order: 2, inMenu: true
  });
  const fixture = {
    site: {
      name: 'Documentation migration', activeTemplate: 'documentation-wide', template: 'documentation-wide',
      accentColor: '#8b5cf6', menuColor: '#8b5cf6', buttonColor: '#8b5cf6', backgroundColor: '#ffffff', textColor: '#101827',
      logoLetters: 'DO', logoBackgroundColor: '#8b5cf6', logoTextColor: '#ffffff', faviconLetters: 'DO',
      faviconBackgroundColor: '#8b5cf6', faviconTextColor: '#ffffff', siteSettings: {}, publishSettings: {}
    },
    pages: [damagedHome, gettingStarted, userArticle], activePageId: damagedHome.id, menuGroups: []
  };

  const migrated = hooks.normalizeState(fixture);
  const home = migrated.pages.find((item) => item.id === 'docs-home-id');
  const article = migrated.pages.find((item) => item.id === 'user-article-id');
  assert.equal(home.slug, 'index', 'Documentation migration restores index slug');
  assert.equal(home.id, 'docs-home-id', 'Documentation migration preserves home ID');
  assert.equal(home.createdAt, createdAt, 'Documentation migration preserves createdAt');
  assert.equal(home.pageName, 'Documentation', 'Documentation migration restores localized home name');
  assert.equal(home.type, 'home');
  assert.equal(home.pagePreset, 'landing');
  assert.equal(home.bodyHtml, expectedBody, 'Documentation migration changes only the first starter FAQ open attribute');
  assert.match(home.bodyHtml, /data-preserve="yes">Preserve this content/, 'Documentation home content is preserved');
  assert.match(home.bodyHtml, /details data-keep="yes"/, 'remaining Documentation FAQ markup is preserved');
  assert.equal(article.slug, 'novaya-stranica-sayta', 'user article slug is unchanged');
  assert.equal(article.pageName, 'Тестовая статья', 'user article name is unchanged');
  assert.equal(article.bodyHtml, '<details open><summary>User detail</summary><p>User body</p></details>', 'user details remain open and unchanged');
  assert.ok(migrated.pages.some((item) => item.id === 'getting-started-id' && item.slug === 'getting-started'), 'separate Getting started page is preserved');

  const once = JSON.stringify(migrated);
  hooks.normalizeState(migrated);
  assert.equal(JSON.stringify(migrated), once, 'Documentation migration is idempotent');

  const payload = hooks.createPublicSitePayload(migrated, home);
  const html = payload.package['index.html'];
  const sidebarMatch = html.match(/<aside class="docs-sidebar-v068d">[\s\S]*?<\/aside>/);
  assert.ok(sidebarMatch, 'Documentation sidebar is rendered');
  assert.equal((sidebarMatch[0].match(/>Getting started<\/a>/g) || []).length, 1, 'Documentation sidebar has one Getting started entry');
  assert.doesNotMatch(html, /getting-started-2\.html/, 'damaged duplicate slug is absent from Documentation output');
  assert.match(html, /Тестовая статья/, 'user article remains in Documentation sidebar');

  const docsStarter = hooks.starterPagesForTemplate('documentation-wide')[0].bodyHtml;
  assert.doesNotMatch(docsStarter, /<details\s+open(?:[\s=>])/, 'future Documentation starter FAQ is closed');
  const landingStarter = hooks.starterPagesForTemplate('project-landing')[0].bodyHtml;
  assert.match(landingStarter, /<details class="faq-item" open>/, 'Landing FAQ remains unchanged and open');

  const landingState = hooks.normalizeState(stateFor('project-landing'));
  const landingHtml = hooks.createPublicSitePayload(landingState, landingState.pages[0]).package['index.html'];
  assert.match(landingHtml, /IRGEZTNE_LANDING_SITE_THEME_V089A/, 'Landing V089A theme mechanism remains present');
}

async function main() {
  testDocumentationRepairAndFaq();
  assert.equal(hooks.normalizePageStatus('draft', 'published'), 'draft');
  assert.equal(hooks.normalizePageStatus('published', 'draft'), 'published');
  assert.equal(hooks.normalizePageStatus(undefined, 'published'), 'published');
  assert.equal(hooks.normalizePageStatus('archived', 'published'), 'draft');

  for (const templateId of templateIds) {
    const state = hooks.normalizeState(stateFor(templateId));
    const byId = (id) => state.pages.find((item) => item.id === id);
    assert.equal(byId('missing-status').status, 'published', `${templateId}: missing legacy status migrates to published`);
    assert.equal(byId('legacy-archived').status, 'draft', `${templateId}: archived migrates to draft`);
    assert.equal(byId('draft-top').status, 'draft', `${templateId}: explicit draft stays draft`);
    assert.equal(byId('published').status, 'published', `${templateId}: explicit published stays published`);
    assert.equal(hooks.editorPages(state).length, 9, `${templateId}: editor sees all normalized pages`);
    assert.equal(hooks.publicPages(state).length, 5, `${templateId}: public set sees normalized published pages`);

    const publicPayload = hooks.createPublicSitePayload(state, byId('draft-top'));
    assertPublicPayload(publicPayload, templateId, 'open-site');
    const zipPayload = hooks.createZipPayload(state, byId('draft-top'));
    assertPublicPayload(zipPayload, templateId, 'zip');
    const publicationPayload = hooks.createPublicationPayload(state, byId('draft-top'));
    assertPublicPayload(publicationPayload, templateId, 'publication');

    const editorPayload = hooks.createEditorPreviewPayload(state, byId('draft-top'));
    assert.ok(editorPayload.package['draft-top.html'], `${templateId}: selected draft is previewable`);
    assert.ok(!editorPayload.package['draft-child.html'], `${templateId}: unrelated draft child stays excluded`);
    assert.ok(!editorPayload.package['draft-footer.html'], `${templateId}: unrelated draft footer stays excluded`);
    assert.equal(editorPayload.activeFileName, 'draft-top.html', `${templateId}: selected draft is active`);

    let materializedPublic;
    window.nsAPI = {
      async materializeSitePreview(payload) {
        materializedPublic = payload;
        return { ok: false };
      }
    };
    await hooks.materializePreviewPackage(state, byId('draft-top'));
    assertPublicPayload(materializedPublic, templateId, 'materialized-open-site');

    const homeHtml = publicPayload.package['index.html'];
    assert.match(homeHtml, /Published Custom/, `${templateId}: published top page is rendered`);
    assert.match(homeHtml, /Missing Status/, `${templateId}: migrated published page is rendered`);
    assert.match(homeHtml, /Published Child/, `${templateId}: published child is rendered in public navigation/sidebar`);
    assert.doesNotMatch(homeHtml, /Draft Child/, `${templateId}: draft child is hidden`);
    assert.doesNotMatch(homeHtml, /Draft Top|Draft Footer|Legacy Archived/, `${templateId}: non-public pages are hidden`);
    assert.match(homeHtml, /Published Footer/, `${templateId}: published footer is rendered`);
    assert.match(homeHtml, />IR</, `${templateId}: logo output is preserved`);

    const fallbackHtml = hooks.renderPublicSiteHtml(state, byId('draft-top'), { linkMode: 'file', inlineAssets: true });
    assert.match(fallbackHtml, /Published Custom/, `${templateId}: public fallback renders published state`);
    assert.doesNotMatch(fallbackHtml, /Draft Top|Draft Child|Draft Footer|Legacy Archived/, `${templateId}: public fallback never renders draft state`);

    if (templateId === 'documentation-wide') {
      assert.match(homeHtml, /docs-sidebar-v068d/, 'Documentation keeps sidebar navigation');
      assert.match(homeHtml, /Missing Status|Published Custom/, 'Documentation sidebar shows published custom pages');
      assert.doesNotMatch(homeHtml, /Draft Top|Draft Child/, 'Documentation sidebar hides drafts');
      assert.match(homeHtml, /aria-label="Main navigation"><button class="theme-toggle"/, 'Documentation does not restore top page menu');
    }
    if (templateId === 'project-landing') {
      assert.match(homeHtml, /Published Custom|Missing Status/, 'Landing menu shows published custom pages');
      assert.match(homeHtml, /Published Footer/, 'Landing footer shows published footer page');
      assert.doesNotMatch(homeHtml, /Draft Top|Draft Child|Draft Footer/, 'Landing menu/footer hide drafts');
    }
  }
  console.log(`PASS: normalized public/fallback contract verified for ${templateIds.length} official templates`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
