# Smart Image Sorter

[![GitHub Pages](https://github.com/ttomohisa/htmlapps-smart-image-sorter/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/ttomohisa/htmlapps-smart-image-sorter/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Single HTML](https://img.shields.io/badge/distribution-single%20HTML-0ea5e9)](https://ttomohisa.github.io/htmlapps-smart-image-sorter/)
[![Local AI](https://img.shields.io/badge/processing-local%20AI-16624F)](#プライバシーと実行時通信)

[English README](README.md)

Smart Image Sorter は、複数の画像をブラウザ内AIでまとめて仕分けし、迷った画像だけ確認して、元画像のままカテゴリ別ZIPへ保存できる単一HTMLアプリです。

選択した画像はアプリからサーバーへアップロードしません。分類・確認・作業状態・ZIP生成は端末内で処理します。

## 🚀 デモ

### [GitHub PagesでSmart Image Sorterを開く](https://ttomohisa.github.io/htmlapps-smart-image-sorter/)

GitHub Pagesから最初のHTMLを読み込んだ後、画像処理はブラウザ内で行われます。インストールやアカウント登録は不要です。

## スクリーンショット

### 日本語 UI

![Smart Image Sorterの日本語画面。仕分け結果と要確認フローを表示](assets/screenshot-ja.png)

### English UI

![Smart Image Sorter English UI showing sorting results and the needs-review flow](assets/screenshot-en.png)

## 主な機能

- **最大500枚をまとめて仕分け** — 画像を個別選択するだけでなく、フォルダごと追加できます。
- **固定カテゴリから必要なものだけ選択** — 最初はおすすめ8カテゴリがONで、内蔵カタログから必要なものだけ使えます。
- **迷った画像だけ確認** — 1位と2位が近い画像などを「要確認」に分け、前後へ移動しながら見直せます。
- **手動変更・一括変更** — 1枚ずつの変更と複数画像の一括変更に対応。一括変更前には確認ダイアログを表示します。
- **処理失敗を分離** — 壊れた画像などが1枚あっても残りの仕分けを継続し、失敗画像だけ再試行・除外できます。
- **元画像のままカテゴリ別ZIPへ保存** — 再圧縮せず、同名ファイルはカテゴリ内で安全に重複回避します。
- **作業を自動保存・復元** — 分類結果や手動修正をブラウザ内へ保存し、同じ画像を選び直すと復元できます。
- **単一HTML・完全ローカル処理** — TinyCLIP vision-only INT8、ラベルEmbedding、Transformers.js、ONNX Runtime Webを配布HTMLへ内包します。
- **日本語 / 英語UI** — 同じHTMLで切り替えられます。

## すぐに使う

### Webで使う

[GitHub Pagesのデモ](https://ttomohisa.github.io/htmlapps-smart-image-sorter/)を開き、画像を追加して2カテゴリ以上を選び、「仕分けを開始」を押します。

### Windowsで単一HTMLをビルドする

1. このリポジトリをダウンロードまたはクローンします。
2. 次を実行します。

```bat
setup-and-build.bat
```

3. 生成された `index.html` をブラウザで開きます。

初回だけ、固定バージョンのブラウザ用ランタイムとTinyCLIPのメタデータを取得します。配布用のvision-only INT8 ONNXモデルと事前計算済みラベルEmbeddingはリポジトリへ同梱済みです。

通常ビルドではPython、uv、ONNX Pythonパッケージは不要です。アセット取得済みなら次だけで再生成できます。

```bat
build-standalone.bat
```

## 使い方

1. **画像を追加** — JPEG / PNG / WebP / AVIF、または画像を含むフォルダを選択します。
2. **カテゴリを選択** — 初期状態ではおすすめ8カテゴリがONです。今回の画像に必要なカテゴリだけ残します。2カテゴリ以上が必要です。
3. **仕分けを開始** — ローカルのTinyCLIP visionモデルで画像Embeddingを計算し、事前計算済みカテゴリEmbeddingと比較します。
4. **要確認だけ見直す** — AIが迷った画像がある場合だけ、要確認フローで確認・修正します。
5. **必要なら結果を修正** — 1枚ずつ変更するか、複数選択して確認ダイアログ付きの一括変更を使います。
6. **カテゴリ別ZIPをダウンロード** — 元画像を再圧縮せず、カテゴリごとにまとめて保存します。

### 「要確認」について

1位の一致度が低め、1位と2位が近い、またはその両方の場合に「要確認」へ回します。表示している一致度は、現在ONにしているカテゴリ候補の中での**相対スコア**であり、AIの正答確率そのものではありません。

### 処理できなかった画像

画像デコードや推論に失敗した画像は通常の結果と分けて表示します。ほかの画像の処理は継続し、個別・一括再試行や一覧からの除外ができます。処理失敗画像はカテゴリ別ZIPには含まれません。

### 作業の自動保存・復元

ブラウザ内に保存するのは、カテゴリ選択、要確認の厳しさ、圧縮した分類結果、レビュー状態、手動修正、ファイル識別情報です。**画像本体と画像Embeddingは保存しません。**

復元時は同じ画像またはフォルダを選び直してください。相対パス（利用可能な場合）・ファイル名・サイズ・更新日時で照合します。作業JSONの保存 / 読み込みもバックアップとして利用できます。

## 固定カテゴリと開発時の追加方法

通常利用では、あらかじめ用意された固定カテゴリから選びます。リリースUIでは自由入力カテゴリを追加しません。

カテゴリ定義:

```text
data/fixed-label-prototypes.json
```

カテゴリを追加・削除したりprototype文を変更する場合:

```bat
dev-update-label-embeddings.bat
build-standalone.bat
```

`dev-update-label-embeddings.bat` で次を再生成します。

```text
data/fixed-label-embeddings.tinyclip-int8.generated.json
```

カテゴリ変更だけなら、配布用の **TinyCLIP vision-only INT8モデル自体を作り直す必要はありません**。通常ビルド時にカテゴリ定義とラベルEmbeddingの整合性を検査し、古い組み合わせではビルドを停止します。

Visionモデルそのものを差し替える場合だけ `dev-reextract-vision-model.bat` と、プロジェクト内のPython / uv / ONNX開発環境を使います。詳しくは [DEVELOPMENT.md](DEVELOPMENT.md) を参照してください。

## カテゴリ回帰テスト

開発者向けの回帰テスト画面があります。

```text
index.html#accuracy-test
```

Top-1 / Top-3、カテゴリ平均、おすすめカテゴリ精度、要確認率、カテゴリ別精度、主な混同を確認できます。データセットレビュー画面では、テスト画像の採用・除外・正解カテゴリ修正もできます。

関連コマンド:

```bat
collect-regression-images.bat
check-regression-dataset.bat -Strict
```

詳しくは [tests/accuracy/README.md](tests/accuracy/README.md) を参照してください。

## GitHub Pagesで公開する

このリポジトリには、Pull Request時のビルド検証と、`main` からのGitHub Pages自動公開Workflowが含まれています。

1. 最初の1回だけ **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にします。
2. `main` へpushします。
3. **Deploy standalone app to GitHub Pages** が、配布モデル検証 → 固定ランタイム取得 → `dist/index.html` ビルド → CSP / 埋め込み検証 → Pages公開まで実行します。
4. 公開先は `https://ttomohisa.github.io/htmlapps-smart-image-sorter/` です。

Pagesがまだ有効でない場合は、ビルド自体は成功し、Workflow Summaryに初回設定手順を表示してデプロイだけをスキップします。

## 開発とビルド構成

```text
.
├─ src/index.template.html
├─ app.config.json
├─ schemas/app-config.schema.json
├─ assets/
│  ├─ favicon.svg
│  ├─ screenshot-en.png
│  └─ screenshot-ja.png
├─ data/
│  ├─ fixed-label-prototypes.json
│  └─ fixed-label-embeddings.tinyclip-int8.generated.json
├─ models/
│  └─ TinyCLIP-ViT-8M-16-Text-3M-YFCC15M-ONNX/
│     └─ onnx/vision_model_quantized.onnx
├─ tools/
├─ tests/
├─ .github/workflows/
│  ├─ build-standalone.yml
│  └─ deploy-pages.yml
├─ setup-and-build.bat
└─ build-standalone.bat
```

配布モデルは8,957,217 bytes、SHA-256は次のとおりです。

```text
bbf8426b0e548881dcfd9257030dd6139fceeeb4808994968b882ecc3ada291f
```

## プライバシーと実行時通信

生成された単一HTMLは、画像処理を端末内で完結させる構成です。

- 選択画像をアプリからサーバーへアップロードしません。
- AIモデルとブラウザ実行ランタイムを配布HTMLへ内包します。
- Content Security Policyで外部の実行時通信を禁止します。
- ZIP生成もブラウザ内で行います。
- 自動保存に画像本体は含みません。

Web版では最初のHTML配信だけ発生します。完全にネットワークを切って使う場合は、`index.html` をビルド後にオフラインで直接開いてください。確認方法は [VERIFY_OFFLINE.md](VERIFY_OFFLINE.md) にあります。

## 制限事項

- 1回に読み込める画像は最大500枚です。
- 利用できるカテゴリはビルド時に定義した固定カテゴリです。
- 一致度は候補カテゴリ間の相対スコアであり、正答確率ではありません。
- 画像形式のデコード可否はブラウザやOSによって差があります。
- 高解像度画像を大量に処理すると、端末のメモリを多く使用します。
- 1回のZIP生成は、対象となる元画像の合計750MBまでです。
- 処理に失敗した画像はカテゴリ別ZIPへ含まれません。
- 作業復元では画像本体を保存しないため、同じ画像を再選択する必要があります。

## 使用コンポーネント

| コンポーネント | バージョン / 構成 | ライセンス | 用途 |
| --- | --- | --- | --- |
| TinyCLIP | ViT-8M/16 vision-only INT8 | 上流モデルの条件に従う | 画像Embedding生成 |
| @huggingface/transformers | 3.8.1 | Apache-2.0 | 前処理・ブラウザ実行補助 |
| onnxruntime-web | 1.22.0-dev.20250409-89f8206ba4 | MIT | ONNX推論 |

第三者コンポーネントの詳細は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を参照してください。

## コントリビューション

バグ報告や機能提案はGitHub Issuesからお願いします。開発手順は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## ライセンス

Copyright © 2026 ttomohisa

このプロジェクトは [MIT License](LICENSE) で公開されています。
