import { Context, validator } from 'https://deno.land/x/hono@v3.11.7/mod.ts';

// メールアドレスの正規表現
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// バリデーション用の型定義
interface UserRegistrationInput {
  username: string;
  email: string;
  password: string;
}

interface LoginInput {
  email: string;
  password: string;
}

// ユーザー登録のバリデーション
export const validateUserRegistration = validator('json', (value: unknown, c: Context) => {
  const body = value as Record<string, unknown>;
  const errors: string[] = [];

  // ユーザー名のバリデーション
  if (!body.username || typeof body.username !== 'string') {
    errors.push('Username is required');
  } else if (body.username.length < 3 || body.username.length > 20) {
    errors.push('Username must be between 3 and 20 characters');
  }

  // メールアドレスのバリデーション
  if (!body.email || typeof body.email !== 'string') {
    errors.push('Email is required');
  } else if (!EMAIL_REGEX.test(body.email)) {
    errors.push('Invalid email format');
  }

  // パスワードのバリデーション
  if (!body.password || typeof body.password !== 'string') {
    errors.push('Password is required');
  } else if (body.password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (errors.length > 0) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'Validation failed', errors }, 400);
  }

  return {
    username: body.username as string,
    email: body.email as string,
    password: body.password as string
  } as UserRegistrationInput;
});

// ログインのバリデーション
export const validateLogin = validator('json', (value: unknown, c: Context) => {
  const body = value as Record<string, unknown>;
  const errors: string[] = [];

  // メールアドレスのバリデーション
  if (!body.email || typeof body.email !== 'string') {
    errors.push('Email is required');
  } else if (!EMAIL_REGEX.test(body.email)) {
    errors.push('Invalid email format');
  }

  // パスワードのバリデーション
  if (!body.password || typeof body.password !== 'string') {
    errors.push('Password is required');
  }

  if (errors.length > 0) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'Validation failed', errors }, 400);
  }

  return {
    email: body.email as string,
    password: body.password as string
  } as LoginInput;
});