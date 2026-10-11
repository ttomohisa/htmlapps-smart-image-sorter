const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const removed = [
  "ヘルプ内をスクロールしている間も閉じるボタンを使えます。背景ページは動きません。",
  "Scroll within Help while its Close button stays reachable. The background page stays in place.",
  "あらかじめ定義した固定カテゴリを使います。カテゴリごとの英語プロトタイプ文はビルド時にEmbedding化して配布します。",
  "ユーザー自由入力カテゴリと補助語は使わず、あらかじめ定義した固定カテゴリを使います。各カテゴリの英語プロトタイプ文はビルド時にEmbedding化して配布します。",
  "Free-form categories and helper words are not used. The app uses a predefined category catalog whose English prototype prompts are embedded as precomputed vectors.",
  "配布版はモデルとランタイムを含む単一HTMLです。画像処理中のネットワーク通信をCSPでも禁止し、選択画像を外部へ送信しません。",
  "The release is one HTML containing the model and runtime. CSP also blocks network connections during processing, and selected images never leave the browser."
];
for (const file of ["src/index.template.html", "smart-image-sorter.html"]) {
  test(`${file}: user help omits implementation commentary`, () => {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    for (const text of removed) assert.ok(!html.includes(text), `Remove implementation copy from ${file}`);
  });
}
