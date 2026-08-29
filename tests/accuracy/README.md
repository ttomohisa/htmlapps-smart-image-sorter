# Category regression test

Smart Image Sorter の固定カテゴリ分類を、モデル・プロトタイプ・カテゴリ追加のたびに同じ条件で確認するための回帰テストです。

## 開き方

生成済み `index.html` に `#accuracy-test` を付けて開きます。

```text
index.html#accuracy-test
```

通常の利用画面では回帰テストUIは表示されません。

## 実画像サンプルを自動収集

Wikimedia Commons から回帰テスト用の実画像を収集できます。

```bat
collect-regression-images.bat
```

既定では **各カテゴリ6枚** を収集します。指定可能範囲は5〜10枚です。

```bat
collect-regression-images.bat -PerCategory 5
collect-regression-images.bat -PerCategory 10
```

保存先:

```text
tests/accuracy/local-samples/<category>/
```

自動収集ファイルは次の形式です。

```text
person__commons_001.jpg
animal__commons_001.jpg
...
```

同時に `_commons-sources.json` と `ATTRIBUTION.md` を生成し、出典ページ・作者・ライセンス情報を記録します。自動収集画像も `.gitignore` 対象なので、通常の配布ZIPには含まれません。

既存の自動収集分だけ取り直す場合:

```bat
collect-regression-images.bat -Force
```

自分で追加した画像は `-Force` でも削除しません。

収集中に処理が中断されても、出典メタデータはカテゴリごとに逐次保存されます。画像だけ残って `_commons-sources.json` に対応する出典情報がない場合は、次回実行時にそのカテゴリの自動収集画像だけを再取得してメタデータを修復します。

新カテゴリを追加した場合、既存26カテゴリのような専用検索クエリがなくても、カテゴリ名とprototypeから検索語を自動生成します。より精度の高い収集をしたい場合は `commons-regression-sources.json` に専用クエリを追加できます。

## 推奨データセット

各カテゴリ **5〜10枚以上** を推奨します。

フォルダ構成で期待ラベルを判定できます。

```text
tests/accuracy/local-samples/
├─ person/
│  ├─ 01.jpg
│  ├─ 02.jpg
│  └─ ...
├─ animal/
├─ food/
├─ scenery/
└─ ...
```

`テストフォルダを選択` から `local-samples` を選べば、フォルダ名とカテゴリ `key` を照合します。

個別に画像を選ぶ場合は、ファイル名の先頭をカテゴリ `key` にしてください。

```text
person__01.jpg
person__02.jpg
animal__01.jpg
receipt__03.jpg
```

## 集計内容

回帰テストでは以下を表示します。

- Overall Top-1 accuracy
- Top-3 accuracy
- Macro Top-1（カテゴリごとのTop-1の単純平均）
- おすすめカテゴリ群のTop-1
- Needs Review率
- カテゴリ別 Top-1 / Top-3 / Needs Review率
- 主な混同（例: `document → receipt`）
- 画像別の判定結果
- データセットのカテゴリカバレッジ

レポートは JSON / CSV で保存できます。

## 回帰データセットレビュー

テスト画像を読み込むと `データセットをレビュー` ボタンが有効になります。

おすすめ手順:

1. `テストフォルダを選択`
2. `回帰テストを実行`
3. `データセットをレビュー`
4. フィルタを `誤分類のみ` にする
5. 画像ごとに `採用` / `除外` / 正解カテゴリ変更
6. 必要に応じて未レビュー画像も確認
7. 回帰テストを再実行

レビュー画面の判断は次回テストに反映されます。

- `採用`: 現在の正解を維持してレビュー済みにする
- `除外`: 集計対象から除外する
- カテゴリ選択: 期待カテゴリを修正する
- `リセット`: その画像のレビュー状態を解除する

ブラウザ内に自動保存されるほか、`レビューJSON` として書き出し / 読み込みできます。別PCや別フォルダで状態を引き継ぐ場合はJSONを利用してください。

レビュー内容を変更すると直前の回帰レポートは古い状態になるため、画面に再実行の案内が表示されます。


## Regression PASS の既定基準

`tests/accuracy/regression-config.json` で変更できます。

- すべてのカテゴリに5枚以上
- Overall Top-1 >= 80%
- おすすめカテゴリ Top-1 >= 85%
- Macro Top-1 >= 75%
- Needs Review率 <= 35%

Needs Review判定は通常利用の「標準」と同じ固定しきい値を回帰テスト側で使い、UI設定には依存しません。

## カテゴリを追加した場合

`data/fixed-label-prototypes.json` にカテゴリを追加すると、回帰テストUIも自動的にそのカテゴリを対象にします。
新カテゴリ用のテスト画像フォルダも同じ `key` で追加してください。

例:

```text
local-samples/music_instrument/
```

つまりカテゴリ数が26から増えても、回帰テストコードの修正は不要です。

## テスト画像について

`tests/accuracy/local-samples/` の画像は `.gitignore` 対象です。
個人写真や権利上公開できない画像を誤ってリポジトリへ含めないため、テスト画像そのものは配布物に含めません。
