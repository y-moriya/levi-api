# Levi API

## プロジェクト概要

このプロジェクトは、DenoとHonoフレームワークを使用して人狼（Werewolf）ゲームのREST
APIを実装するものです。まずはデータベースを使わず、オンメモリでの状態管理を行い、基本的なゲーム機能を実現します。

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

実装フェーズと進捗状況については [tasks.md](./tasks.md) を参照してください。

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
