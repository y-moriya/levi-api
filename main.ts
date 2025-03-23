import { Hono } from 'https://deno.land/x/hono@v3.11.7/mod.ts';
import { cors } from 'https://deno.land/x/hono@v3.11.7/middleware.ts';
import { Context } from 'https://deno.land/x/hono@v3.11.7/context.ts';
import { config } from './config.ts';
import auth from './routes/auth.ts';

const app = new Hono();

// グローバルミドルウェア
app.use('*', cors());

// ルート
app.route('/v1/auth', auth);

// 404ハンドラ
app.notFound((c: Context) => {
  return c.json({ 
    code: 'NOT_FOUND', 
    message: 'Not Found' 
  }, 404);
});

// エラーハンドラ
app.onError((err: Error, c: Context) => {
  console.error(`Error: ${err}`);
  return c.json({ 
    code: 'INTERNAL_ERROR', 
    message: 'Internal Server Error' 
  }, 500);
});

// サーバー起動
Deno.serve({ port: config.port }, app.fetch);
console.log(`Server running on http://localhost:${config.port}`);