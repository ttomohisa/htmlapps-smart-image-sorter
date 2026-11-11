// Static release checks run during PR validation before any tag or release can be created.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root,name), 'utf8');
const cfg = JSON.parse(read('app.config.json'));
const version = cfg.version;
const tag = 'v' + version;

test('release is the declared patch version with a dated changelog',()=>{
  assert.equal(version,'1.0.6');
  assert.match(read('CHANGELOG.md'), /## 1\.0\.6 - 2026-11-11/);
  assert.ok(fs.existsSync(path.join(root,'docs/releases',tag+'.md')));
  assert.match(read('src/index.template.html'), /id="versionBadge">v1\.0\.6/);
  assert.match(read('src/index.template.html'), /id="footerVersion">v1\.0\.6/);
  for(const name of ['build-standalone.yml','deploy-pages.yml','preview.yml']){
    assert.match(read('.github/workflows/'+name), /v1\\\.0\\\.6/);
    assert.doesNotMatch(read('.github/workflows/'+name), /v1\\\.0\\\.5/);
  }
});

test('release publishing runs only after a main update or manual dispatch',()=>{
  const yml=read('.github/workflows/release.yml');
  assert.match(yml,/^  push:/m);
  assert.match(yml,/^    branches:\s*\n\s*- main/m);
  assert.match(yml,/^  workflow_dispatch:/m);
  assert.match(yml,/github\.ref == 'refs\/heads\/main'/);
  assert.match(yml,/version -ne '1\.0\.6'/);
  assert.match(yml,/needs\.build\.outputs\.publish == 'true'/);
  assert.match(yml,/contents: write/);
  assert.match(yml,/gh release view/);
  assert.match(yml,/gh release create/);
  assert.match(yml,/--target "\$GITHUB_SHA"/);
  assert.match(yml,/main_sha.*\$GITHUB_SHA/);
  assert.match(yml,/sha256sum -c SHA256SUMS\.txt/);
  assert.match(yml,/docs\/releases\/v1\.0\.6\.md/);
});

test('release package is built from dist, not the stale checked-in HTML',()=>{
  const script=read('tools/package-release.ps1');
  assert.match(script,/dist\/index\.html/);
  assert.match(script,/htmlapps-smart-image-sorter-v\$version/);
  assert.match(script,/SHA256SUMS\.txt/);
  assert.match(script,/Get-FileHash/);
  assert.match(script,/Compress-Archive/);
  assert.match(script,/smart-image-sorter\.html.*Stale root HTML/);
  assert.match(read('.github/workflows/build-standalone.yml'), /tools\/package-release\.ps1/);
});
