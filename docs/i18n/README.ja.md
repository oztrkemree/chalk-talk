<div align="center">

# chalk-talk

### 地図は読まない。旅路を見る。

コーディングエージェントに *「これってどう動いてるの？」* と聞くだけで、実際のコードパスをステップごとにたどるアニメーション解説が、HTML ファイル 1 つで手に入ります。**すべての矢印は、それが起きるコードの行まで追跡されています**。追跡できないものは、正直に「推測」と明示されます。

[**ライブサイト & ギャラリー**](https://oztrkemree.github.io/chalk-talk/) · [インストール](#インストール) · [証拠](#すべての矢印に裏付けがある) · [PR を解説](#プルリクエストを解説する) · [シーン形式](../../skills/chalk-talk/references/scene-spec.md)

![MIT ライセンス](https://img.shields.io/badge/license-MIT-blue) ![HTML ファイル 1 つ](https://img.shields.io/badge/output-one%20HTML%20file-ff5a5f) ![依存関係なし](https://img.shields.io/badge/dependencies-none-2ea44f) ![Agent Skills](https://img.shields.io/badge/Agent%20Skills-Claude%20Code%20%C2%B7%20Codex%20%C2%B7%20Cursor%20%C2%B7%20Gemini-d97757)

[English](../../README.md) · [简体中文](README.zh-CN.md) · 日本語 · [한국어](README.ko.md) · [Español](README.es.md) · [Türkçe](README.tr.md)

![git commit がディスクに書き込むものを黒板に描いた図：オブジェクトが 1 つずつ現れ、その間をパケットが行き来する](../media/hero-chalk.gif)

<sub>`git commit` を git 自身のソースから解説。9 ホップ中 9 ホップをコードまで追跡済み。<a href="https://oztrkemree.github.io/chalk-talk/gallery/git-commit/git-commit.html?style=chalk">ライブで開く →</a></sub>

</div>

## なぜ

ダイアグラムやナレッジグラフが見せてくれるのは**何が存在するか**です。でも、初めてのコードベースに飛び込んだときや、AI が書いた PR を前に固まっているときに知りたいのは、**何が、どの順番で、コードのどこで起きるのか**です。

chalk-talk は、ホワイトボードの前に立つ腕のいいエンジニアのように答えます。一度に一つずつ。最初の箱、一文の説明、矢印、そしてその上を流れるパケット（「`JWT`」「`order #42`」「`SELECT`」）。前の部分は薄く引いて、新しい部分が光ります。最後に旅の全体をリプレイ。ブロックや矢印をクリックすれば、該当するコード行が GitHub のパーマリンク付きで開きます。

エージェントが書くのは小さなシーンファイルだけ。レイアウト、経路の取り回し、3D 描画、アニメーションはエンジンが引き受け、さらに全ステップのスクリーンショットを撮るので、あなたが見る前にエージェント自身が出来栄えをチェックできます。

## すべての矢印に裏付けがある

間違ったアニメーション図は、図がないより悪い。*よりもっともらしい*ハルシネーションだからです。だから chalk-talk の矢印は、ただ描かれるのではなく**出典付き**です：

```json
{ "from": "router", "to": "layer", "label": "match(path)",
  "code": "router/index.js:230-247", "calls": "matchLayer(layer, path)" }
```

ビルド時にファイルを開いてその行を読み、`matchLayer(layer, path)` が本当にそこにあるかを確認します。そのうえで、すべての矢印に印が付きます：

| 印 | 意味 |
|---|---|
| ✓ **verified**（検証済み） | 引用した行が存在し、その呼び出しを含んでいる |
| **?** **inferred**（推定） | 指し示せる行がない（ネットワーク境界、動的ディスパッチなど）。理由を併記 |
| **!** **broken**（不一致） | その行に呼び出しが見つからない。ビルドが警告し、エージェントが直す |

```
$ node scripts/build.mjs express-request.scene.json
proof: 7/9 hops traced to code (7 verified, 0 cited) · 2 inferred · 0 broken
```

どのトークでも **`V`** を押せば、どのホップが証明済みかがひと目で分かります。最後のまとめでもはっきり伝えます：*"7 of 9 hops traced to code · 2 inferred"*。

![証拠ビュー：Express 5 のリクエストの旅。証明済みの矢印にはチェックマーク、推定の 2 ホップは点線と疑問符](../media/proof-view.png)

## ギャラリー

以下のトークはすべて、エージェントが実際のソースから書いたもので、すべての矢印がチェック済みです。

| トーク | リポジトリ | 証拠 |
|---|---|---|
| [git commit がディスクに書き込むもの](https://oztrkemree.github.io/chalk-talk/gallery/git-commit/git-commit.html) | git/git | 9/9 追跡済み |
| [Codex CLI がシェルコマンドを実行する仕組み](https://oztrkemree.github.io/chalk-talk/gallery/codex-exec/codex-exec.html) | openai/codex | 10/10 追跡済み |
| [Vite がモジュールをホットアップデートする仕組み](https://oztrkemree.github.io/chalk-talk/gallery/vite-hmr/vite-hmr.html) | vitejs/vite | 7/8 追跡済み、1 推定 |
| [Redis は `SET greeting hello` で何をしているのか](https://oztrkemree.github.io/chalk-talk/gallery/redis-set/redis-set.html) | redis/redis | 8/9 追跡済み、1 推定 |
| [FastAPI があなたの関数を呼ぶまで](https://oztrkemree.github.io/chalk-talk/gallery/fastapi-request/fastapi-request.html) | fastapi/fastapi | 8/9 追跡済み、1 推定 |
| [リクエストが `app.get()` に届いたとき何が起きるか](https://oztrkemree.github.io/chalk-talk/gallery/express-request/express-request.html) | expressjs/express | 7/9 追跡済み、2 推定 |
| [PR #7459：チャンク化レスポンスに ETag が戻る](https://oztrkemree.github.io/chalk-talk/gallery/express-pr/express-pr.html) | expressjs/express | 5/6 追跡済み、1 推定 |
| [chalk-talk はどうやってすべての矢印を証明するのか](https://oztrkemree.github.io/chalk-talk/skills/chalk-talk/examples/build.html) | このリポジトリ | 6/7 追跡済み、1 推定 |

`→` / `space` で進む、`P` で再生、`V` で証拠ビュー、`T` でライト/ダーク切り替え。ブロックや矢印をクリックするとそのコードが開きます。

## プルリクエストを解説する

> この PR を chalk talk で解説して

エージェントは diff を読み、**変更後の姿**で旅を語りながら、変わった部分をハイライトします：`NEW`、`CHANGED`、`REMOVED`、`PR #7459 · +2 ~4` のチップ、そして **`D`** で変更前と変更後を切り替え。GIF を PR の説明に貼っておけば、レビュアーはコードを読む前に変更を目でつかめます。

![変更モード：Express の PR #7459。変更されたブロックは琥珀色の輪で囲まれ、新しいハンドラーは緑、PR チップは隅に表示](../media/change-mode.png)

## インストール

**Claude Code**

```
/plugin marketplace add oztrkemree/chalk-talk
/plugin install chalk-talk@chalk-talk
```

**Codex、Cursor、Gemini CLI、OpenCode、Copilot ほか [40 以上のエージェント](https://agentskills.io)**

```bash
npx skills add oztrkemree/chalk-talk
```

**手動で**：`skills/chalk-talk` をエージェントの skills フォルダ（`~/.claude/skills/`、`~/.codex/skills/` など）にコピーします。

スクリプトには Node 18 以上が必要です（Windows、macOS、Linux）。ビジュアルのセルフチェックには、インストール済みの Chrome、Edge、Brave、Chromium のどれかを使います。

## 使い方

どんな言語でも、普通に聞くだけ：

> このリポジトリの認証ってどうなってる？
>
> Webhook が届いたときに何が起きるか、順を追って説明して
>
> この PR を chalk talk で解説して

または直接呼び出し：`/chalk-talk 購入フロー`。

エージェントは `chalk-talks/<name>.scene.json` を書き、`chalk-talks/<name>.html` をビルドし、各ステップをスクリーンショットで確認してから開きます。シーンファイルは残しておきましょう。「ステップ 3 を分けて」「リトライの経路も見せて」と頼めば、エージェントがそれを編集します。

| キー | 動作 |
|---|---|
| `→` / `space` / クリック | 次のステップ |
| `←` | 前のステップ |
| `P` | 自動再生（URL に `?play=loop` を付けるとループ） |
| `V` | 証拠ビュー：どのホップがコードまで追跡されているか |
| `D` | PR トークで変更前 / 変更後を切り替え |
| `C` / ブロックや矢印をクリック | その裏にあるコード |
| `T` | ライト ↔ ダーク |
| `1`–`9` | 指定のステップへジャンプ（URL の `#3` でも可） |

スマホではボードが縦向きになり、各ステップで扱う部分に自動でフォーカスします。

## 共有する

トークは **HTML ファイル 1 つ**。サーバー不要、オフラインで動き、誰にでも送れます。`CHALK_SHARE=1` を付ければローカルのパスを除き、GitHub のパーマリンクは残します。

README や PR、Slack にそのまま貼りたい？

```bash
node skills/chalk-talk/scripts/record.mjs chalk-talks/auth.html --out auth.gif --style chalk
```

`record.mjs` はインストール済みの Chrome をフレーム単位で操作し（ffmpeg も npm パッケージも不要）、ループする GIF を書き出します。`--steps 2-5`、`--width 960`、`--theme dark` も使えます。

## スタイル

| | |
|---|---|
| **iso**（デフォルト） | アイソメトリックな床の上に並ぶ小さな 3D ブロック。パケットが届くとサーバーが点滅し、書き込みでデータベースに波紋が広がり、キューは溜まっては捌けていく |
| **chalk** | 同じボードを黒板にチョークで描いたもの。手描きの線とパステル調のハッチング |
| **studio** · **blueprint** · **editorial** | 大きめのシステム向けのフラットなカードレイアウト |

シーンに `"style": "chalk"` と書くか、任意のトークに `?style=chalk` を付けるだけ。

## 仕組み

```
your question ──▶ agent reads the code ──▶ scene.json ──▶ build.mjs ──▶ talk.html
                                               ▲          (proof check)      │
                                               └──── check.mjs: report + PNG per step
```

シーンはただの JSON です。粗いグリッド上のノード、ノード間のエッジ（それを裏付けるコード付き）、そして何を見せ、何が流れ、何を語るかを書いたステップ：

```json
{
  "title": "How logging in works",
  "nodes": [
    { "id": "web", "kind": "browser", "label": "Web app", "at": [0, 0] },
    { "id": "api", "label": "Auth API", "sub": "POST /login", "icon": "key", "at": [1, 0],
      "code": "src/auth/login.ts:12-40" }
  ],
  "edges": [
    { "id": "req", "from": "web", "to": "api", "label": "POST /login", "packet": "email, pw",
      "code": "src/web/login.tsx:31-38", "calls": "fetch('/login'" }
  ],
  "steps": [
    { "title": "The request", "say": "The web app sends both to the **Auth API**.", "show": ["req"], "flow": ["req"] }
  ]
}
```

エンジン（HTML テンプレート 1 つ、依存関係なし）はグリッドをアイソメトリックな床に投影し、各ノードを 3D オブジェクトとして描き、ブロックを避けて経路を引き、何も隠さない位置にラベルを置きます。自力で解決できなかった問題は報告する（`arrow api -> db runs through cache`）ので、エージェントがシーンを修正します。ブロックは 9 種類、アイコンは 37 個、ハンドシェイクや OAuth 向けのシーケンスレイアウト、スタイルは 5 種類。詳細はすべて[シーンリファレンス](../../skills/chalk-talk/references/scene-spec.md)にあります。

エージェントなしで、手動でトークをビルドすることもできます：

```bash
node skills/chalk-talk/scripts/build.mjs my-talk.scene.json   # writes my-talk.html, checks proof
node skills/chalk-talk/scripts/check.mjs my-talk.html         # layout report + a PNG per step
```

## FAQ

**それでも間違うことはある？** あります。エージェントが話の筋を取り違えたり、単純化しすぎたりすることはあり得ます。でも、コードに存在しない呼び出しを主張する矢印を、黙って描くことはできません。それは `!` とビルド警告になります。`?` の印は、トークがコードの行ではなく判断に頼っている箇所を正確に示します。

**コードがどこかに送信される？** いいえ。chalk-talk はエージェントがローカルで実行するスキルです。ページはディスク上のファイルで、何もアップロードされません。

**大きなリポジトリは？** 1 トークにつき旅は 1 つ、ブロックは 8 個ほど。次の旅を頼めば、次のトークが出てきます。読めない巨大な地図 1 枚より、小さく焦点を絞ったトークのほうがずっと伝わります。

## クレジット

- フォント：Vercel の [Geist](https://vercel.com/font)、IBM の [IBM Plex](https://www.ibm.com/plex/)、[Inter Tight](https://rsms.me/inter/)、[Newsreader](https://fonts.google.com/specimen/Newsreader)、[Caveat](https://fonts.google.com/specimen/Caveat)、[Patrick Hand](https://fonts.google.com/specimen/Patrick+Hand)。いずれも SIL Open Font License で、Google Fonts から読み込んでおり、同梱はしていません。
- ステップ送りのアイデアは、Nicky Case の explorable explanations と Julia Evans の zine に多くを負っています。

## ライセンス

[MIT](../../LICENSE)。自由に使って、フォークして、リリースしてください。何かを理解する助けになったなら、⭐ を付けてもらえると、ほかの人にも見つけてもらいやすくなります。
