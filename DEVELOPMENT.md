# Smart Image Sorter - Development

通常利用ではこの文書の作業は不要です。

## 1. 通常ビルド

Windowsで:

```bat
setup-and-build.bat
```

初回セットアップでは、固定バージョンのTransformers.js / ONNX Runtime Web、TinyCLIPの `config.json` / `preprocessor_config.json` / LICENSEを取得します。

配布用の `vision_model_quantized.onnx` とラベルEmbeddingはリポジトリへコミット済みで、通常ビルドでは再生成しません。

アセット取得済みなら:

```bat
build-standalone.bat
```

## 2. カテゴリ / prototypeを追加・変更する

編集対象:

```text
data/fixed-label-prototypes.json
```

例:

```json
{
  "key": "music_instrument",
  "ja": "楽器",
  "en": "Musical instruments",
  "recommended": false,
  "group": "more",
  "prototypes": [
    "a photo of a musical instrument",
    "a photo of a guitar",
    "a photo of a piano"
  ]
}
```

変更後:

```bat
dev-update-label-embeddings.bat
```

更新されるファイル:

```text
data/fixed-label-embeddings.tinyclip-int8.generated.json
```

この生成物もコミットしてください。

### 重要

カテゴリ変更だけなら `vision_model_quantized.onnx` の再生成は不要です。画像側とテキスト側が同じTinyCLIPのEmbedding空間を使うため、ラベル側Embeddingだけ更新します。

通常ビルドは次の整合性を検査し、不一致なら停止します。

- カテゴリ数
- keyと順序
- 日本語 / 英語ラベル
- prototype数
- prototype文字列と順序
- 各vectorが512次元か

## 3. vision-onlyモデル自体を再抽出する

通常は不要です。TinyCLIPモデルを差し替える場合に限って:

```bat
dev-reextract-vision-model.bat
```

この処理では **uv + Python + onnx** を使用し、プロジェクト内に `.venv-onnx` を作成します。

出力:

```text
models/TinyCLIP-ViT-8M-16-Text-3M-YFCC15M-ONNX/onnx/vision_model_quantized.onnx
```

SHA-256が変わった場合は、少なくとも以下を更新してください。

- `model-manifest.json`
- `tools/setup-assets.ps1`
- `tools/build-standalone.ps1`
- `.github/workflows/build-standalone.yml`
- `.github/workflows/deploy-pages.yml`
- `README.md` / `README.ja.md`
- `APP_SPEC.md`
- `THIRD_PARTY_NOTICES.md`

## 4. Git管理方針

正式リリース用の8.5MB ONNXは通常Gitで管理します。

```text
models/.../onnx/vision_model_quantized.onnx
```

以下は開発時のみ取得し、Git管理しません。

```text
models/.../onnx/model_quantized.onnx
models/.../tokenizer.json
models/.../tokenizer_config.json
models/.../special_tokens_map.json
models/.../merges.txt
models/.../vocab.json
.venv-onnx/
```

## 5. 回帰テスト

カテゴリやprototypeを変更したら:

```bat
check-regression-dataset.bat -Strict
```

その後 `index.html#accuracy-test` で同じサンプルセットを実行して比較します。

データセットレビューでは、採用・除外・正解カテゴリ変更・リセットを記録できます。変更後は回帰テストを再実行してください。

## 6. 作業状態の保存・復元

通常画面は `smart-image-sorter.work-session.v1` を localStorage に保存します。これはアプリのリリース番号ではなく、保存データ形式のschema識別子です。

保存対象はカテゴリ・厳しさ・ファイル識別情報・分類結果・要確認・手動修正・処理失敗状態です。画像本体と画像Embeddingは保存しません。

## 7. ZIP衝突対策の確認ポイント

最終ZIP pathはサニタイズ後・大文字小文字を区別せず一意になる必要があります。少なくとも次を確認してください。

- `foo.jpg`, `foo.jpg`, `foo_2.jpg`
- `A.JPG`, `a.jpg`
- `a:b.jpg`, `a?b.jpg`

## 8. リリース前チェック

- `app.config.json` と画面のversionが一致する
- model SHA-256がmanifest / scripts / READMEと一致する
- fixed category definitions と生成済みlabel embeddingsが一致する
- 日本語 / 英語の翻訳キーが一致する
- 重複IDがない
- 単一HTMLに未置換placeholderが残らない
- CSPが外部runtime通信を許可しない
- PC幅と主要スマホ幅で横スクロールが発生しない
- 一括変更の確認ダイアログが現在の言語で表示される
- 要確認0件時にreview-only導線が残らない
- 処理失敗画像がZIPへ混入しない
- `main` pushでPages workflowが起動する
- `assets/screenshot-en.png` / `assets/screenshot-ja.png` が現行UIと一致する
