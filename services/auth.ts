import { AuthToken, Login, User, UserRegistration } from "../types/user.ts";
import { comparePassword, hashPassword } from "../utils/password.ts";
import { createJwt } from "../utils/jwt.ts";
import { config } from "../config.ts";

// インメモリユーザーストレージ
const users: Map<string, User> = new Map();

// テスト用のリセット関数
export const resetStore = () => {
  users.clear();
};

export const register = async (data: UserRegistration): Promise<User> => {
  // メールアドレスの重複チェック
  if (Array.from(users.values()).some((user) => user.email === data.email)) {
    throw new Error("Email already exists");
  }

  const hashedPassword = await hashPassword(data.password);
  const userId = crypto.randomUUID();

  const user: User = {
    id: userId,
    username: data.username,
    email: data.email,
    password: hashedPassword,
    createdAt: new Date().toISOString(),
    stats: {
      gamesPlayed: 0,
      gamesWon: 0,
      winRatio: 0,
      villagerWins: 0,
      werewolfWins: 0,
    },
  };

  users.set(userId, user);
  const { password: _password, ...userWithoutPassword } = user;
  return userWithoutPassword as User;
};

export const login = async (data: Login): Promise<AuthToken> => {
  const user = Array.from(users.values()).find((u) => u.email === data.email);
  if (!user) {
    throw new Error("Invalid credentials");
  }

  const isValid = await comparePassword(data.password, user.password);
  if (!isValid) {
    throw new Error("Invalid credentials");
  }

  const token = await createJwt({ sub: user.id });
  const expiresAt = new Date(Date.now() + parseInt(config.jwt.expiresIn) * 60 * 60 * 1000).toISOString();

  const { password: _password, ...userWithoutPassword } = user;
  return {
    token,
    expiresAt,
    user: userWithoutPassword,
  };
};

export const getUserById = (userId: string): Omit<User, "password"> | undefined => {
  const user = users.get(userId);
  if (!user) return undefined;

  const { password: _password, ...userWithoutPassword } = user;
  return userWithoutPassword;
};
