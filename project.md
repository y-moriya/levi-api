# Levi API

## プロジェクト概要

このプロジェクトは、DenoとHonoフレームワークを使用して人狼（Werewolf）ゲームのREST APIを実装するものです。まずはデータベースを使わず、オンメモリでの状態管理を行い、基本的なゲーム機能を実現します。

## 技術スタック

- **実行環境**: Deno
- **フレームワーク**: Hono
- **データストレージ**: インメモリ（オブジェクト）
- **認証**: JWT

## プロジェクト構造

```
/
├── main.ts                # エントリーポイント
├── config.ts              # 設定ファイル
├── routes/                # ルート定義
│   ├── index.ts           # ルート集約
│   ├── auth.ts            # 認証関連
│   ├── users.ts           # ユーザー関連
│   ├── games.ts           # ゲーム関連
│   ├── actions.ts         # ゲームアクション関連
│   └── chat.ts            # チャット関連
├── controllers/           # コントローラー
│   ├── auth.ts
│   ├── users.ts
│   ├── games.ts
│   ├── actions.ts
│   └── chat.ts
├── models/                # データモデル
│   ├── user.ts
│   ├── game.ts
│   └── chat.ts
├── services/              # ビジネスロジック
│   ├── auth.ts
│   ├── users.ts
│   ├── games.ts
│   ├── game-logic.ts      # ゲームロジック管理
│   └── chat.ts
├── middleware/            # ミドルウェア
│   ├── auth.ts            # 認証ミドルウェア
│   └── validation.ts      # バリデーション
├── utils/                 # ユーティリティ
│   ├── jwt.ts             # JWT関連
│   ├── password.ts        # パスワード暗号化
│   └── errors.ts          # エラーハンドリング
└── types/                 # 型定義
    ├── index.ts           # 型定義の集約
    ├── user.ts
    ├── game.ts
    ├── action.ts
    └── chat.ts
```

## 実装フェーズ

### フェーズ1: 基本設定とユーザー認証

1. プロジェクト初期化とHonoセットアップ
2. ユーザー登録・ログイン機能の実装
3. JWT認証の実装

### フェーズ1.1: ブラッシュアップ

1. JWTシークレットを環境変数から読み込むように変更
2. バリデーションの強化
3. テストの実装
4. ロギングの追加

### フェーズ2: ゲーム管理基本機能

1. ゲーム作成・参加・退出機能
2. ゲーム情報取得API
3. ゲーム一覧取得API

### フェーズ2.1: APIテスト実装

1. テスト用サーバーを起動し、HTTPリクエストを送ってレスポンスを検証するAPIテストを実装する
2. ユーザーのAPIテストを実装
3. ゲームのAPIテストを実装

### フェーズ3: ゲームロジック実装

1. ゲーム開始機能
2. フェーズ管理（昼・投票・夜）
3. 役職割り当て

### フェーズ4: ゲームアクション実装

1. 投票アクション
2. 人狼の襲撃アクション
3. 占い師の占いアクション
4. 狩人の護衛アクション

### フェーズ5: チャット機能実装

1. チャットメッセージ送信・取得
2. チャンネル管理（村全体・人狼間）

## 実装状況

現在の実装状況は以下の通りです：

### 完了したフェーズ

#### フェーズ1: 基本設定とユーザー認証 ✅
- プロジェクト初期化とHonoセットアップ
- ユーザー登録・ログイン機能の実装
- JWT認証の実装

#### フェーズ1.1: ブラッシュアップ ✅
- JWTシークレットを環境変数から読み込むように変更
- バリデーションの強化
- テストの実装
- ロギングの追加

### 次のフェーズ

フェーズ2（ゲーム管理基本機能）の実装に移行予定です。

## 主要コード実装サンプル

### main.ts

```typescript
import { Hono } from 'https://deno.land/x/hono/mod.ts';
import { cors } from 'https://deno.land/x/hono/middleware.ts';
import { routes } from './routes/index.ts';
import { errorHandler } from './middleware/error.ts';

const app = new Hono();

// ミドルウェア
app.use('*', cors());
app.use('*', errorHandler);

// ルート
app.route('/', routes);

// 404
app.notFound((c) => {
  return c.json({ 
    code: 'NOT_FOUND', 
    message: 'Not Found' 
  }, 404);
});

// サーバー起動
Deno.serve({ port: 8080 }, app.fetch);
console.log('Server running on http://localhost:8080');
```

### models/user.ts

```typescript
import { v4 as uuid } from 'https://deno.land/std/uuid/mod.ts';
import { hashPassword } from '../utils/password.ts';
import { User, UserRegistration } from '../types/user.ts';

// インメモリユーザーストレージ
const users: Map<string, User> = new Map();

export const createUser = async (data: UserRegistration): Promise<User> => {
  const id = uuid();
  const hashedPassword = await hashPassword(data.password);
  
  const user: User = {
    id,
    username: data.username,
    email: data.email,
    password: hashedPassword,
    createdAt: new Date().toISOString(),
    stats: {
      gamesPlayed: 0,
      gamesWon: 0,
      winRatio: 0,
      villagerWins: 0,
      werewolfWins: 0
    }
  };
  
  users.set(id, user);
  return { ...user, password: undefined }; // パスワードを除外して返す
};

export const findUserById = (id: string): User | undefined => {
  const user = users.get(id);
  if (user) {
    // パスワードを除外したオブジェクトを返す
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }
  return undefined;
};

export const findUserByEmail = (email: string): User | undefined => {
  for (const user of users.values()) {
    if (user.email === email) {
      return user;
    }
  }
  return undefined;
};
```

### controllers/games.ts

```typescript
import { Context } from 'https://deno.land/x/hono/mod.ts';
import * as gameService from '../services/games.ts';
import { GameCreation } from '../types/game.ts';

export const getGames = async (c: Context) => {
  const games = await gameService.getAllGames();
  return c.json(games, 200);
};

export const getGame = async (c: Context) => {
  const gameId = c.req.param('gameId');
  const userId = c.get('userId');
  
  try {
    const game = await gameService.getGameById(gameId, userId);
    return c.json(game, 200);
  } catch (error) {
    if (error.message === 'Game not found') {
      return c.json({ code: 'GAME_NOT_FOUND', message: error.message }, 404);
    }
    throw error;
  }
};

export const createGame = async (c: Context) => {
  const userId = c.get('userId');
  const data = await c.req.json() as GameCreation;
  
  try {
    const game = await gameService.createGame(data, userId);
    return c.json(game, 201);
  } catch (error) {
    return c.json({ code: 'INVALID_REQUEST', message: error.message }, 400);
  }
};

export const joinGame = async (c: Context) => {
  const gameId = c.req.param('gameId');
  const userId = c.get('userId');
  
  try {
    const game = await gameService.joinGame(gameId, userId);
    return c.json(game, 200);
  } catch (error) {
    if (error.message === 'Game not found') {
      return c.json({ code: 'GAME_NOT_FOUND', message: error.message }, 404);
    } else if (error.message.includes('full') || error.message.includes('already')) {
      return c.json({ code: 'JOIN_ERROR', message: error.message }, 400);
    }
    throw error;
  }
};
```

### middleware/auth.ts

```typescript
import { Context, Next } from 'https://deno.land/x/hono/mod.ts';
import { verifyJwt } from '../utils/jwt.ts';

export const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ code: 'UNAUTHORIZED', message: 'Authentication required' }, 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = await verifyJwt(token);
    c.set('userId', payload.sub);
    await next();
  } catch (error) {
    return c.json({ code: 'INVALID_TOKEN', message: 'Invalid or expired token' }, 401);
  }
};
```

### services/game-logic.ts

```typescript
import { v4 as uuid } from 'https://deno.land/std/uuid/mod.ts';
import { Game, GamePlayer, GameSettings, RoleSettings } from '../types/game.ts';
import { findUserById } from '../models/user.ts';

// 役職をランダムに割り当てる
export const assignRoles = (game: Game): void => {
  const players = [...game.players];
  const roles: string[] = [];
  const settings = game.settings;
  
  // 役職リストを作成
  for (let i = 0; i < settings.roles.werewolfCount; i++) {
    roles.push('WEREWOLF');
  }
  
  for (let i = 0; i < settings.roles.seerCount; i++) {
    roles.push('SEER');
  }
  
  for (let i = 0; i < settings.roles.bodyguardCount; i++) {
    roles.push('BODYGUARD');
  }
  
  for (let i = 0; i < settings.roles.mediumCount; i++) {
    roles.push('MEDIUM');
  }
  
  // 残りは村人
  const villagerCount = players.length - roles.length;
  for (let i = 0; i < villagerCount; i++) {
    roles.push('VILLAGER');
  }
  
  // 役職をシャッフル
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }
  
  // プレイヤーに役職を割り当て
  for (let i = 0; i < players.length; i++) {
    players[i].role = roles[i];
  }
  
  game.players = players;
};

// ゲームの勝敗判定
export const checkGameEnd = (game: Game): { isEnded: boolean, winner: string } => {
  const alivePlayers = game.players.filter(p => p.isAlive);
  const aliveWerewolves = alivePlayers.filter(p => p.role === 'WEREWOLF');
  
  // 人狼が全滅した場合、村人の勝利
  if (aliveWerewolves.length === 0) {
    return { isEnded: true, winner: 'VILLAGERS' };
  }
  
  // 人狼の数が村人陣営の数以上になった場合、人狼の勝利
  const aliveVillagers = alivePlayers.filter(p => p.role !== 'WEREWOLF');
  if (aliveWerewolves.length >= aliveVillagers.length) {
    return { isEnded: true, winner: 'WEREWOLVES' };
  }
  
  return { isEnded: false, winner: 'NONE' };
};

// フェーズを進める
export const advancePhase = (game: Game): void => {
  // 現在のフェーズに基づいて次のフェーズを設定
  switch (game.currentPhase) {
    case 'DAY_DISCUSSION':
      game.currentPhase = 'DAY_VOTE';
      game.phaseEndTime = new Date(Date.now() + game.settings.voteTimeSeconds * 1000).toISOString();
      break;
    case 'DAY_VOTE':
      game.currentPhase = 'NIGHT';
      game.phaseEndTime = new Date(Date.now() + game.settings.nightTimeSeconds * 1000).toISOString();
      break;
    case 'NIGHT':
      game.currentDay += 1;
      game.currentPhase = 'DAY_DISCUSSION';
      game.phaseEndTime = new Date(Date.now() + game.settings.dayTimeSeconds * 1000).toISOString();
      break;
    default:
      break;
  }
  
  // ゲームイベントを記録
  game.gameEvents.push({
    id: uuid(),
    day: game.currentDay,
    phase: game.currentPhase,
    type: 'PHASE_CHANGE',
    description: `フェーズが${game.currentPhase}に変更されました`,
    timestamp: new Date().toISOString()
  });
};
```

## 注意点と制約

1. **インメモリストレージ**: サーバー再起動でデータは消失します。本番環境へ移行する際はデータベース連携が必要です。

2. **並行処理**: 複数リクエストの同時処理に注意が必要です。実際の実装ではロック機構の検討が必要です。

3. **タイマー管理**: フェーズの自動進行には、Denoのタイマー機能と状態管理の連携が必要です。

4. **エラーハンドリング**: 包括的なエラーハンドリングとバリデーションが必要です。

5. **テスト**: 各機能に対するユニットテストと統合テストの実装を推奨します。

## 実装の進め方

1. まずは基本的なHonoアプリケーションとルーティングを設定
2. ユーザー登録・認証系APIを実装
3. ゲーム管理の基本機能を実装
4. ゲームロジックを段階的に実装
5. チャット機能の実装

## 拡張可能性

1. **データベース連携**: MongoDBやPostgreSQLなどと連携
2. **WebSocket対応**: リアルタイム通信のためのWebSocket実装
3. **フロントエンド開発**: このAPIを利用するフロントエンドの開発
4. **役職追加**: より多様な役職の追加実装
5. **イベントログ**: 詳細なゲームイベントログ機能

## 開発開始コマンド

```
deno run --allow-net --allow-env main.ts
```