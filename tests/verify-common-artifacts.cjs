const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const html=fs.readFileSync('dist/index.html');assert.deepEqual(fs.readFileSync('smart-image-sorter.html'),html);
const text=html.toString('utf8'),pin=JSON.parse(fs.readFileSync('components/ui-conventions.lock.json'));
for(const name of ['ui-conventions.js','ui-conventions.css']){const bytes=fs.readFileSync('components/'+name);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),pin.files[name]);assert.ok(text.includes(bytes.toString('utf8')));}
assert.match(text,/connect-src blob:/);assert.doesNotMatch(text,/connect-src[^;]*(https?:|\*)/);
for(const placeholder of ['__BK_UI_JS__','__BK_UI_CSS__','__APP_CONFIG_JSON__','__BUILD_MANIFEST_JSON__','__EMBEDDED_ASSET_BUNDLE_JSON__','__FIXED_CATEGORY_CATALOG_JSON__','__ACCURACY_REGRESSION_CONFIG_JSON__'])assert.ok(!text.includes(placeholder),placeholder);
console.log('Canonical embedded hashes, root/dist parity, placeholders and CSP pass.');
