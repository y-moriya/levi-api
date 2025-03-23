import { Context, validator } from 'https://deno.land/x/hono@v3.11.7/mod.ts';
import { GameCreation, GameSettings } from '../types/game.ts';

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

// ゲーム作成のバリデーション
export const validateGameCreation = validator('json', (value: unknown, c: Context) => {
  const body = value as Record<string, unknown>;
  const errors: string[] = [];

  // ゲーム名のバリデーション
  if (!body.name || typeof body.name !== 'string') {
    errors.push('Game name is required');
  } else if (body.name.length < 3 || body.name.length > 30) {
    errors.push('Game name must be between 3 and 30 characters');
  }

  // プレイヤー数のバリデーション
  if (!body.maxPlayers || typeof body.maxPlayers !== 'number') {
    errors.push('Maximum players is required');
  } else if (body.maxPlayers < 3 || body.maxPlayers > 20) {
    errors.push('Maximum players must be between 3 and 20');
  }

  // ゲーム設定のバリデーション（オプショナル）
  let settings: GameSettings | undefined;
  if (body.settings) {
    const settingsInput = body.settings as Record<string, unknown>;
    const rolesInput = (settingsInput.roles as Record<string, unknown>) || {};
    
    // 時間設定のバリデーション
    if (settingsInput.dayTimeSeconds && (typeof settingsInput.dayTimeSeconds !== 'number' || settingsInput.dayTimeSeconds < 60)) {
      errors.push('Day time must be at least 60 seconds');
    }
    if (settingsInput.nightTimeSeconds && (typeof settingsInput.nightTimeSeconds !== 'number' || settingsInput.nightTimeSeconds < 30)) {
      errors.push('Night time must be at least 30 seconds');
    }
    if (settingsInput.voteTimeSeconds && (typeof settingsInput.voteTimeSeconds !== 'number' || settingsInput.voteTimeSeconds < 30)) {
      errors.push('Vote time must be at least 30 seconds');
    }

    // 役職設定のバリデーション
    if (settingsInput.roles) {
      if (rolesInput.werewolfCount && (typeof rolesInput.werewolfCount !== 'number' || rolesInput.werewolfCount < 1)) {
        errors.push('At least 1 werewolf is required');
      }
      if (rolesInput.seerCount && (typeof rolesInput.seerCount !== 'number' || rolesInput.seerCount < 0)) {
        errors.push('Seer count cannot be negative');
      }
      if (rolesInput.bodyguardCount && (typeof rolesInput.bodyguardCount !== 'number' || rolesInput.bodyguardCount < 0)) {
        errors.push('Bodyguard count cannot be negative');
      }
      if (rolesInput.mediumCount && (typeof rolesInput.mediumCount !== 'number' || rolesInput.mediumCount < 0)) {
        errors.push('Medium count cannot be negative');
      }
    }

    // バリデーションに成功した場合、設定オブジェクトを作成
    settings = {
      dayTimeSeconds: typeof settingsInput.dayTimeSeconds === 'number' ? settingsInput.dayTimeSeconds : 300,
      nightTimeSeconds: typeof settingsInput.nightTimeSeconds === 'number' ? settingsInput.nightTimeSeconds : 180,
      voteTimeSeconds: typeof settingsInput.voteTimeSeconds === 'number' ? settingsInput.voteTimeSeconds : 60,
      roles: {
        werewolfCount: typeof rolesInput.werewolfCount === 'number' ? rolesInput.werewolfCount : 2,
        seerCount: typeof rolesInput.seerCount === 'number' ? rolesInput.seerCount : 1,
        bodyguardCount: typeof rolesInput.bodyguardCount === 'number' ? rolesInput.bodyguardCount : 1,
        mediumCount: typeof rolesInput.mediumCount === 'number' ? rolesInput.mediumCount : 0
      }
    };
  }

  if (errors.length > 0) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'Validation failed', errors }, 400);
  }

  return {
    name: body.name as string,
    maxPlayers: body.maxPlayers as number,
    password: body.password as string | undefined,
    settings: settings
  } as GameCreation;
});