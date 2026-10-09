import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

// Unit coverage of real header-localization statements, without media, models,
// camera access, browser rendering, or changes to application persistence.
const app = 'smart-image-sorter';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'app.config.json'), 'utf8'));
const icon = fs.readFileSync(path.join(root, 'assets/favicon.svg'), 'utf8');
test('app icon preserves supplied foreground artwork and native viewBox after background normalization', () => {
  assert.equal(createHash('sha256').update(icon.replace(/<rect[^>]*\/>/, "<path fill=\"#086a53\" d=\"M225 46q31-1 63 0H820q30-1 61 1 41 6 75 27 76 46 96 133 5 33 4 67V852q0 20-1 39-12 81-76 133-43 32-97 41-18 1-36 1H260q-27 1-54-2c-54-9-105-43-134-89q-26-39-32-85-2-33 0-68V298q-4-52 6-102C62 137 105 89 159 64q31-15 66-18\"/>").replaceAll('#16624f', '#086a53')).digest('hex'), '127b334fc088a1588af9f84e2402c4dbf3a4e042120b9f2206e519787b66c4fa');
  assert.match(icon, /viewBox="0 0 1095 1095"/);
});
const targets = process.argv.slice(2);
if (!targets.length) targets.push('src/index.template.html');
const video = app === 'video-face-redactor';
const popup = app === 'popup-face-check-in';
const photo = app === 'photo-re-enactor';
const languageIds = video ? ['lang'] : popup ? ['langBtn'] : photo ? ['languageButton', 'mobileLanguageButton'] : ['languageButton'];
const helpIds = video ? ['help'] : popup ? ['helpBtn'] : photo ? ['helpButton', 'mobileHelpButton'] : ['helpButton'];

function block(source, start) {
  let depth = 0, quote = '', escape = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === quote) quote = '';
    } else if (['"', "'", '`'].includes(ch)) quote = ch;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('Source block is incomplete');
}
function element(tag) {
  const attrs = Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
  const dataset = Object.fromEntries(Object.entries(attrs).filter(([k]) => k.startsWith('data-')).map(([k, v]) => [k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v]));
  return { attrs, dataset, title: attrs.title || '', textContent: '', querySelector() { return null; }, setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k] ?? null; } };
}
for (const target of targets) {
  const html = fs.readFileSync(path.resolve(root, target), 'utf8');
  test(`${target}: header and favicon embed the exact app artwork`, () => {
    const headerIcon = html.match(/<div class="brand-mark" aria-hidden="true">(.*?)<\/div>/s)?.[1];
    assert.equal(headerIcon, icon);
    const favicon = html.match(/<link rel="icon"[^>]*href="([^"]+)"/)?.[1];
    assert.ok(favicon?.startsWith('data:image/svg+xml,'), 'favicon stays self-contained');
    assert.equal(decodeURIComponent(favicon.slice('data:image/svg+xml,'.length)), icon);
    assert.match(html, /\.brand-mark svg\{width:100%;height:100%\}/);
  });

  test(`${target}: three-part header version matches app metadata`, () => {
    assert.match(config.version, /^\d+\.\d+\.\d+$/);
    assert.equal(html.match(/class="(?:version-badge|version)"[^>]*>([^<]+)/)?.[1], `v${config.version}`);
    if (popup) assert.ok(html.includes(`app:'Pop-up Face Check-in',version:'${config.version}'`), 'history export app version matches');
    if (!video && !popup && !target.startsWith('src/')) {
      const start = html.search(/const APP_CONFIG\s*=/);
      assert.ok(start >= 0);
      assert.equal(JSON.parse(block(html, html.indexOf('{', start))).version, config.version);
    }
  });

  test(`${target}: repeated JA/EN controls have localized destination and Help names`, () => {
    const all = new Map();
    const get = id => {
      id = id.replace(/^#/, '');
      if (!all.has(id)) all.set(id, element(html.match(new RegExp(`<[^>]*\\bid="${id}"[^>]*>`))?.[0] || ''));
      return all.get(id);
    };
    [...languageIds, ...helpIds].forEach(get);
    const select = selector => [...all.values()].filter(el => {
      if (selector === '[data-ja][data-en]') return el.dataset.ja && el.dataset.en;
      const key = selector.slice(1, -1).replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      return el.dataset[key];
    });
    let translations;
    if (!video && !popup) {
      const start = html.search(/const translations\s*=/);
      assert.ok(start >= 0);
      translations = vm.runInNewContext(`(${block(html, html.indexOf('{', start))})`, {}, { timeout: 1000 });
    }
    const name = video ? 'applyLang' : popup ? 'updateLang' : 'applyLanguage';
    const start = html.indexOf(`function ${name}(`);
    assert.ok(start >= 0);
    const body = block(html, html.indexOf('{', start)).slice(1);
    const marker = video ? "if($('appMobileBottomBar'))" : popup ? 'updatePasswordToggleLabels()' : photo ? "$('#headerAppName')" : 'document.title=';
    const end = body.indexOf(marker);
    assert.ok(end > 0, 'header localization boundary exists');
    const code = body.slice(0, end);
    const document = { documentElement: {}, querySelectorAll: select };
    for (const language of ['ja', 'en', 'ja', 'en']) {
      const pair = (ja, en) => language === 'ja' ? ja : en;
      const translate = key => translations?.[language]?.[key] ?? key;
      vm.runInNewContext(code, { document, $: get, $$: select, lang: language, language, state: { language }, t: pair, tr: video ? pair : translate, translate }, { timeout: 1000 });
      assert.equal(document.documentElement.lang, language);
      for (const id of languageIds) {
        const el = get(id), destination = language === 'ja' ? '英語に切り替え' : 'Switch to Japanese';
        assert.equal(el.textContent, language === 'ja' ? 'EN' : 'JA', id);
        assert.equal(el.title, destination, `${id} title`);
        assert.equal(el.getAttribute('aria-label'), destination, `${id} accessible name`);
      }
      const help = video ? pair('使い方と注意事項', 'How to use & notes') : popup ? pair('使い方と注意事項', 'How to use and precautions') : translate('helpTitle');
      for (const id of helpIds) {
        assert.equal(get(id).title, help, `${id} title`);
        assert.equal(get(id).getAttribute('aria-label'), help, `${id} accessible name`);
      }
    }
  });

  test(`${target}: existing local-processing badge copy stays truthful and bilingual`, () => {
    if (video || popup) {
      const english = video ? ['Video stays on this device', 'Local processing'] : ['On-device only'];
      for (const text of english) {
        const match = html.match(new RegExp(`<[^>]+data-en="${text}"[^>]*>([^<]+)`));
        assert.ok(match, 'existing English badge is preserved');
        assert.equal(element(match[0]).dataset.ja, '完全ローカル処理');
        assert.equal(match[1], '完全ローカル処理');
      }
    } else {
      assert.ok(html.includes('完全ローカル処理'));
      assert.ok(html.includes('Fully local processing'));
    }
  });
}
