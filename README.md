# Motif

**音楽解説系 YouTuber 動画の代替。**

気になるアーティストを見つけたとき、その音楽性を解説した動画が都合よく存在することはまれだ。
LLM に聞けば言葉では説明してくれるが、「〇〇な音を多用している」と言われても実際にどんな音かはわからない。

Motif はアーティスト名を入力するだけで、**Spotify のプレビューや YouTube MV の実際の音源を聴きながら**、AI が音楽性を解説してくれる。YouTuber が「ここを聴いてください」と言いながら解説するのと同じ体験を、どんなアーティストでも即座に生み出す。

---

## 主な機能

| 機能 | 概要 |
|---|---|
| アーティスト検索 | Spotify のアーティストデータベースをリアルタイム検索 |
| ストリーミング解析 | Claude が生成する音楽性解説をリアルタイム表示 |
| オーディオキューカード | 解説内の「聴いてみてください」ポイントをクリックで即再生 |

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | React 19 + TypeScript + Vite |
| スタイリング | Tailwind CSS v4 + Framer Motion |
| バックエンド | Express.js + TypeScript (tsx) |
| AI 解析 | Google Gemini API (`gemini-2.5-flash`) |
| 音楽データ | Spotify Web API (OAuth 2.0 Authorization Code) |
| キャッシュ | Upstash Redis |

---

## セットアップ

### 前提条件

- Node.js 20 以上
- Spotify アカウント + [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) でのアプリ登録
- [Google AI Studio](https://aistudio.google.com/) の Gemini API キー

### インストール

```bash
git clone https://github.com/your-username/motif.git
cd motif
npm install
```

### 環境変数

`.env.example` をコピーして `.env` を作成し、各値を設定してください。

```bash
cp .env.example .env
```

| 変数名 | 説明 |
|---|---|
| `SPOTIFY_CLIENT_ID` | Spotify アプリのクライアント ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify アプリのクライアントシークレット |
| `GEMINI_API_KEY` | Google Gemini API キー |
| `YOUTUBE_API_KEY` | YouTube Data API v3 キー |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis の REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis の REST トークン |
| `APP_URL` | アプリの公開 URL（ローカルでは `http://localhost:3000`） |

Spotify Developer Dashboard の「Redirect URIs」に `{APP_URL}/api/auth/spotify/callback` を追加してください。

### 開発サーバー起動

```bash
npm run dev
```

`http://localhost:3000` でアクセスできます。

### プロダクションビルド

```bash
npm run build
npm run preview
```

---

## アーキテクチャ

```
ブラウザ
  │
  ├── Spotify OAuth ポップアップ → /api/auth/spotify/callback
  │     └── アクセストークンを postMessage でクライアントに返却
  │
  ├── Spotify Web API（クライアント直接呼び出し）
  │     ├── アーティスト検索
  │     └── トラック検索 → Spotify Embed Player
  │
  └── Gemini API（クライアント直接呼び出し）
        └── JSON 構造化レスポンス（summary / keyTraits / deepDive）
              └── deepDive 内のトラックリンクは track: スキームでクリック再生に変換
```

Express サーバーは Spotify OAuth のコールバック処理のみを担い、フロントエンドは Vite のミドルウェアとして提供されます。
