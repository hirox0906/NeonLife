# NEON LIFE OVERDRIVE

ネオン風の演出で複数のセル・オートマトンを観察できる、ブラウザ向けシミュレーターです。依存ライブラリやビルド処理はなく、静的ファイルだけで動作します。

## 収録モデル

| モデル | 概要 | 初期パラメータ |
| --- | --- | --- |
| Conway's Life | 標準的なライフゲーム | B3/S23 |
| Wa-Tor | 魚の繁殖とサメの捕食・餓死 | 魚繁殖 6、サメ繁殖 10、体力 7、捕食回復 5 |
| HighLife | 自己複製パターンを持つLife系ルール | B36/S23 |
| Seeds | 生存セルが毎世代消滅する拡散的なルール | B2/S |
| Brian's Brain | 発火、休止、死の3状態モデル | 発火近傍 2、休止 1ターン |
| Rock Paper Scissors | グー、パー、チョキによる循環侵食 | 侵食近傍 3、突然変異率 0% |

Life系モデルの `BIRTH (B)` と `SURVIVE (S)` には、適用する近傍数を続けて入力します。例えば `B=36` は「近傍が3個または6個なら誕生」を意味します。

## 操作

- `MODEL`: シミュレーションモデルを変更
- `BRUSH`: クリックまたはドラッグで配置するセル／種族を変更
- 右ドラッグ: セルを消去
- `RUN`: 再生／一時停止
- `STEP`: 一時停止して1世代だけ進める
- `RANDOM BURST`: 現在のモデルで盤面をランダム生成
- `CLEAR`: 盤面を消去
- `RESET SETTINGS`: モデル固有パラメータとSPEED、CELL、CHAOSを初期値へ戻す
- `Space`: 再生／一時停止
- `R`: ランダム生成
- `C`: 盤面を消去

`RESET SETTINGS`は盤面や選択中のモデルを変更しません。

## ファイル構成

```text
.
├── index.html       # ページ構造と操作UI
├── favicon.svg      # ブラウザータブ用アイコン
├── styles.css       # レイアウトとネオン表示
├── life-rules.js    # 各モデルの状態と更新ルール
└── script.js        # Canvas描画、入力、UI制御
```

## ローカルで実行する

JavaScript Modulesを使用しているため、ファイルを直接開かずローカルサーバー経由で確認してください。

```bash
python -m http.server 8000
```

起動後、ブラウザで `http://localhost:8000/` を開きます。

## GitHub Pagesで公開する

1. このフォルダーのファイルをGitHubリポジトリのルートへ追加します。
2. GitHubのリポジトリ画面から **Settings → Pages** を開きます。
3. **Build and deployment** のSourceで **Deploy from a branch** を選択します。
4. 公開ブランチを `main`、フォルダーを `/(root)` にして保存します。
5. デプロイ完了後、表示されたPagesのURLへアクセスします。

詳しい手順は[GitHub公式ドキュメント](https://docs.github.com/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)を参照してください。

## 対応環境

JavaScript Modules、Canvas 2D、Pointer Eventsに対応した最新のChrome、Edge、Firefox、Safariを推奨します。

## ライセンス

[MIT License](./LICENSE)
