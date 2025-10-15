# glean-workshop


## ビルド後にfaviconが消える問題について

`claat` のビルドにより各モジュールの `<head>` が再生成されるため、`<link rel="icon">` が消えることがあります。以下のポストビルドスクリプトで自動挿入できます。

### 手順

1. Node.js が必要です（任意のLTS推奨）。
2. ビルド実行後に次を実行:

```bash
node scripts/postbuild-favicon.js
```

このスクリプトは以下のファイルに `/assets/favicon.svg?v=2` を挿入/更新します。

- `index.html`
- `1-glean-search/index.html`
- `2-glean-assistant/index.html`
- `3-glean-agents/index.html`

CI等で自動化する場合は、claatビルドの直後に上記コマンドを追加してください。

## claatの実行とfavicon挿入を一体化したスクリプト

対話式でビルド対象を選び、`claat export <ID>` を選択数分だけ実行し、その後favicon挿入を行うスクリプトを用意しています。

### 実行方法（対話式・Node版）

```bash
node scripts/claat-build.js
```

プロンプト:

```
どのドキュメントをビルドしますか？
1. glean-search: 16x-OdU8ooq3FszzRhmj-8hLzJejvYKGIVADoPWnlvos
2. glean-chat: 1AYqOEx4SQ9UgA_0fSpwV0ydjjBLhK1sv1-r8uuje07w
3. glean-agent: 1tw7IPtWMpOumljfOmLRrQ3O_P8Fxt7U5rT8BpFCnA6w

番号をカンマ区切りで入力してください (例: 1,3)
```

選択した番号に対応するIDを使って `claat export <ID>` を順に実行（実際の実行は出力先固定のため `-o <outDir>` を付与）し、最後に `scripts/postbuild-favicon.js` を実行します。ログには `claat export <ID>` の形式で表示されます。

### 実行方法（非対話式・番号/ID混在可）

```bash
node scripts/claat-build.js 1,3
```

またはIDで指定:
```bash
node scripts/claat-build.js 1tw7IPtWMpOumljfOmLRrQ3O_P8Fxt7U5rT8BpFCnA6w
```

### 実行方法（シェル版）

Node不要のシェル版ラッパーも用意しています。

対話式:
```bash
bash scripts/claat-build.sh
```

非対話式:
```bash
bash scripts/claat-build.sh 1,3
```

