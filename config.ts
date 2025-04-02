import "https://deno.land/x/dotenv@v3.2.2/load.ts";

/**
 * 環境変数を取得し、指定された型に変換する関数
 * @param key 環境変数名
 * @param defaultValue デフォルト値
 * @param validator 検証関数（オプション）
 * @returns 変換された値
 */
function getEnv<T>(
  key: string,
  defaultValue: T,
  validator?: (value: T) => boolean,
): T {
  const envValue = Deno.env.get(key);

  // 環境変数が設定されていない場合はデフォルト値を使用
  if (envValue === undefined) {
    return defaultValue;
  }

  // 型に応じた変換処理
  let typedValue: T;
  if (typeof defaultValue === "number") {
    typedValue = Number(envValue) as unknown as T;
    if (isNaN(typedValue as unknown as number)) {
      console.warn(
        `警告: 環境変数 ${key} の値 "${envValue}" は数値に変換できません。デフォルト値 ${defaultValue} を使用します。`,
      );
      return defaultValue;
    }
  } else if (typeof defaultValue === "boolean") {
    typedValue = (envValue.toLowerCase() === "true") as unknown as T;
  } else {
    typedValue = envValue as unknown as T;
  }

  // バリデーション処理
  if (validator && !validator(typedValue)) {
    console.warn(`警告: 環境変数 ${key} の値 "${envValue}" は無効です。デフォルト値 ${defaultValue} を使用します。`);
    return defaultValue;
  }

  return typedValue;
}

// 環境タイプの定義
export type Environment = "development" | "test" | "production";

// 設定オブジェクトの型定義
export interface Config {
  port: number;
  env: Environment;
  version: string;
  jwt: {
    secret: string;
    expiresIn: string;
  };
  password: {
    saltRounds: number;
  };
  logging: {
    level: string;
  };
}

// 環境変数の検証関数
const isValidEnvironment = (env: string): env is Environment =>
  ["development", "test", "production"].includes(env as Environment);

const isValidLogLevel = (level: string): boolean => ["error", "warn", "info", "debug", "trace"].includes(level);

// 設定値の読み込みと検証
const initialConfig: Partial<Config> = {
  port: getEnv("PORT", 8080, (port) => port > 0 && port < 65536),
  env: getEnv("NODE_ENV", "development", isValidEnvironment) as Environment,
  version: "1.0.0",
};

export const config: Config = {
  ...initialConfig,
  jwt: {
    secret: getEnv(
      "JWT_SECRET",
      "fallback-secret-key-do-not-use-in-production",
      (secret) => secret.length >= 32 || initialConfig.env !== "production",
    ),
    expiresIn: getEnv("JWT_EXPIRES_IN", "24h", (val) => val.length > 0),
  },
  password: {
    saltRounds: getEnv("PASSWORD_SALT_ROUNDS", 10, (rounds) => rounds > 0 && rounds <= 20),
  },
  logging: {
    level: getEnv("LOG_LEVEL", "info", isValidLogLevel),
  },
} as Config;

// 本番環境でシークレットキーが弱い場合の警告
if (
  config.env === "production" &&
  config.jwt.secret === "fallback-secret-key-do-not-use-in-production"
) {
  console.error(
    "警告: 本番環境で安全でないデフォルトのJWTシークレットキーを使用しています。環境変数 JWT_SECRET を設定してください。",
  );
}
