#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = process.cwd();
const sourcePath = path.join(root, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js');
const source = fs.readFileSync(sourcePath, 'utf8');

function fail(message) {
  console.error('FAIL:', message);
  process.exit(1);
}

function extractFunction(name) {
  const needle = `function ${name}`;
  const start = source.indexOf(needle);
  if (start < 0) fail(`${name} is missing`);
  const endMarker = '\n  /* IRGEZTNE_OFFICIAL_FOUR_THEME_RUNTIME_V098D';
  const end = source.indexOf(endMarker, start);
  if (end < 0) fail(`Could not find end marker for ${name}`);
  return source.slice(start, end);
}

const fnSource = extractFunction('applyOfficialFourBrandLogoV098F');
const context = {
  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },
  normalizeOfficialTemplateIdV068C(value) { return String(value || ''); },
  logoHeaderSizePx() { return 44; },
  logoHeaderFontSizePx() { return 18; },
  logoCssRadius() { return '13px'; },
  logoFontFamily() { return 'Inter, sans-serif'; }
};
vm.createContext(context);
vm.runInContext(`${fnSource}; this.applyOfficialFourBrandLogoV098F = applyOfficialFourBrandLogoV098F;`, context);
const applyLogo = context.applyOfficialFourBrandLogoV098F;
const site = {
  logoBackgroundColor: '#8b5cf6',
  logoTextColor: '#ffffff',
  logoShape: 'rounded',
  logoWeight: '900'
};

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

const business = applyLogo(
  '<html><head></head><body><a class="brand" href="index.html"><strong>Business</strong><span>Systems</span></a></body></html>',
  'business-product', site, 'B'
);
if (count(business, 'irgeztne-site-logo-v098f') !== 2) fail('Business should have one logo element and one CSS selector occurrence');
if (!business.includes('irgeztne-site-brand-copy-v098f')) fail('Business brand text must be wrapped beside the logo');

const blog = applyLogo(
  '<html><head></head><body><a class="brand" href="index.html"><strong>Blog</strong><span>Journal</span><small>News</small></a></body></html>',
  'blog-news', site, 'N'
);
if (!blog.includes('irgeztne-brand-logo-v098f--blog-news')) fail('Blog must receive its layout-specific brand class');
if (!blog.includes('grid-template-columns:auto auto')) fail('Blog copy layout must be preserved');

const portfolio = applyLogo(
  '<html><head></head><body><a class="brand" href="index.html"><span class="brand-mark">A</span><span class="brand-copy"><strong>Portfolio</strong></span></a></body></html>',
  'studio-portfolio', site, 'P'
);
if (portfolio.includes('class="brand-mark"')) fail('Portfolio native A mark must be replaced');
if (!portfolio.includes('>P</span>')) fail('Portfolio configured P logo is missing');
if (portfolio.includes('>A</span>')) fail('Portfolio old A mark survived');

const agency = applyLogo(
  '<html><head></head><body><a class="brand" href="index.html"><span class="brand-mark">V</span><span><strong>Agency</strong></span></a></body></html>',
  'agency-studio', site, 'A'
);
if (agency.includes('class="brand-mark"')) fail('Agency native V mark must be replaced');
if (!agency.includes('>A</span>')) fail('Agency configured A logo is missing');
if (agency.includes('>V</span>')) fail('Agency old V mark survived');

if (!source.includes('IRGEZTNE_LOGO_FAVICON_INDEPENDENT_V098F')) fail('Logo/favicon independence contract is missing');
if (source.includes('faviconWasFollowingLogoV084U')) fail('Old favicon-following state mutation is still active');
if (!source.includes('updateIdentityHeaderLogoV098F(state2.site)')) fail('Live Web Studio header update is missing');
if (!source.includes('IRGEZTNE_IDENTITY_HEADER_LIVE_V098F')) fail('Live identity marker is missing');

console.log('PASS: Web Studio V098F logo slot and favicon independence verified');
