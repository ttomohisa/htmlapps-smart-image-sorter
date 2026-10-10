const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Execute the production Help bindings with a minimal dialog event double.
// Actual modal rendering, pointer targeting and native Escape require browser QA.
const root = path.join(__dirname, '..');
const targets = process.argv.slice(2);
if (!targets.length) targets.push(process.env.SORTER_HTML || 'src/index.template.html');
for (const target of targets) {
const html = fs.readFileSync(path.resolve(root, target), 'utf8');
const start = html.indexOf("$('#helpButton').onclick");
const end = html.indexOf("$$('.mobile-tab[data-mobile-page-target]')", start);
assert.ok(start >= 0 && end > start, 'production Help bindings exist');
const bindings = html.slice(start, end);

function harness() {
  const listeners = new Map();
  const opener = { focused: false, focus() { this.focused = true; } };
  const closeButton = {};
  const dialog = {
    open: false, closeCount: 0,
    getBoundingClientRect: () => ({ left: 282.5, right: 882.5, top: 78, bottom: 679 }),
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    dispatch(type, event = {}) { for (const listener of listeners.get(type) || []) listener(event); },
    showModal() { this.open = true; },
    close() { this.open = false; this.closeCount++; this.dispatch('close'); }
  };
  const elements = { '#helpButton': opener, '#closeHelpButton': closeButton, '#helpDialog': dialog };
  vm.runInNewContext(bindings, { $: id => elements[id] }, { timeout: 1000 });
  return { dialog, opener, closeButton };
}

test('outside Help geometry dismisses the dialog and restores its opener', () => {
  for (const [clientX, clientY] of [[90, 100], [900, 100], [500, 50], [500, 700]]) {
    const { dialog, opener } = harness();
    opener.onclick();
    dialog.dispatch('click', { target: dialog, clientX, clientY });
    assert.equal(dialog.open, false, `outside point ${clientX},${clientY}`);
    assert.equal(dialog.closeCount, 1);
    assert.equal(opener.focused, true);
  }
});

test('inside content, dialog padding and its boundary do not dismiss Help', () => {
  const { dialog, opener } = harness();
  opener.onclick();
  for (const [clientX, clientY] of [[500, 100], [282.5, 78], [882.5, 679]]) {
    dialog.dispatch('click', { target: dialog, clientX, clientY });
    assert.equal(dialog.open, true);
  }
  dialog.dispatch('click', { target: {}, clientX: 500, clientY: 100 });
  dialog.dispatch('click', { target: dialog });
  assert.equal(dialog.open, true);
  assert.equal(dialog.closeCount, 0);
  assert.equal(opener.focused, false);
});

test('events on a closed Help dialog do not close again or steal focus', () => {
  const { dialog, opener } = harness();
  dialog.dispatch('click', { target: dialog, clientX: 90, clientY: 100 });
  assert.equal(dialog.closeCount, 0);
  assert.equal(opener.focused, false);
});

test('Close button and the native close event share opener focus restoration', () => {
  const { dialog, opener, closeButton } = harness();
  opener.onclick();
  closeButton.onclick();
  assert.equal(dialog.open, false);
  assert.equal(opener.focused, true);
  opener.focused = false;
  opener.onclick();
  dialog.close();
  assert.equal(opener.focused, true);
});

// These CSS contracts complement, rather than replace, native wheel/geometry checks.
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const rule = selector => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, selectors]) => selectors.split(',').map(s => s.trim()).includes(selector)).map(([, , declarations]) => declarations).join(';');
test('modal Help locks both scrolling roots without locking closed Help', () => {
  for (const root of ['html', 'body']) assert.match(rule(`${root}:has(#helpDialog:modal)`), /overflow\s*:\s*hidden/);
});
test('Help allocates its fixed header and shrinking scroll body within the viewport', () => {
  assert.match(rule('#helpDialog[open]'), /display\s*:\s*flex/);
  assert.match(rule('#helpDialog[open]'), /flex-direction\s*:\s*column/);
  assert.match(rule('#helpDialog[open]'), /max-height\s*:\s*calc\(100dvh - 28px\)/);
  assert.match(rule('#helpDialog[open]'), /overflow\s*:\s*hidden/);
  assert.match(rule('#helpDialog > .dialog-header'), /flex\s*:\s*0 0 auto/);
  assert.match(rule('#helpDialog > .dialog-body'), /min-height\s*:\s*0/);
  assert.match(rule('#helpDialog > .dialog-body'), /flex\s*:\s*1 1 auto/);
  assert.match(rule('.dialog-body'), /overflow\s*:\s*auto/);
  assert.match(rule('#helpDialog[open]'), /max-height\s*:\s*85dvh/);
});
test('narrow title and version can wrap without hiding the version or shrinking header actions', () => {
  assert.doesNotMatch(rule('.version-badge'), /display\s*:\s*none/);
  assert.match(rule('.brand-name'), /flex-wrap\s*:\s*wrap/);
  assert.match(rule('.brand-name'), /white-space\s*:\s*normal/);
  assert.match(rule('.version-badge'), /flex\s*:\s*0 0 auto/);
  assert.match(rule('.header-actions'), /flex-shrink\s*:\s*0/);
});
test('localized Help explains its scrolling and reachable Close control', () => {
  assert.match(html, /data-i18n="helpScroll"/);
  assert.match(html, /helpScroll:'ヘルプ内をスクロールしている間も閉じるボタンを使えます。背景ページは動きません。'/);
  assert.match(html, /helpScroll:'Scroll within Help while its Close button stays reachable\. The background page stays in place\.'/);
});

}

test('all publishing workflows require the Help regression after building', () => {
  for (const name of ['build-standalone.yml', 'deploy-pages.yml', 'preview.yml']) {
    const yaml = fs.readFileSync(path.join(root, '.github/workflows', name), 'utf8');
    assert.match(yaml, /node \.\/tests\/help-dialog\.test\.cjs src\/index\.template\.html dist\/index\.html/);
  }
});


test('publishing version guards match app.config.json', () => {
  const version = JSON.parse(fs.readFileSync(path.join(root, 'app.config.json'), 'utf8')).version;
  for (const name of ['build-standalone.yml', 'deploy-pages.yml', 'preview.yml']) {
    const yaml = fs.readFileSync(path.join(root, '.github/workflows', name), 'utf8');
    assert.ok(yaml.includes("'v" + version.split('.').join('\\.') + "'"), `${name} release guard must match ${version}`);
  }
});
