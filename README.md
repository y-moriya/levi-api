# Levi API - Werewolf Game REST API

Deno + Hono で構築した人狼ゲームの REST API です。オンメモリ実装を基盤に、JWT 認証と各種ゲーム機能を提供します。

## ドキュメント

- ドキュメント集約: docs/（[docs/README.md](./docs/README.md)）
  - 開発ルール: [docs/contributing.md](./docs/contributing.md)
  - ハンドオフサマリー（現状/次のタスク）: [docs/handoff-summary.md](./docs/handoff-summary.md)
  - ロードマップ: [docs/roadmap.md](./docs/roadmap.md)
  - ゲームルール: [docs/game-rules.md](./docs/game-rules.md)
  - テストシナリオ: [docs/test-scenarios.md](./docs/test-scenarios.md)
  - OpenAPI: [openapi.yaml](./openapi.yaml)

## セットアップ

1. Deno をインストール
2. 開発サーバー起動
   ```bash
   deno run --allow-net --allow-env main.ts
   ```

## テスト

```bash
deno test -A
```

## 注意事項

- データはオンメモリで、再起動で消えます。
- フェーズ進行はタイマーで管理します。
- エラー処理とバリデーションを実装済みです。

## ライセンス

MIT
