import { AuthToken, Login, User, UserRegistration } from "../types/user.ts";
import { comparePassword, hashPassword } from "../utils/password.ts";
import { createJwt } from "../utils/jwt.ts";
import { config } from "../config.ts";
import { repositoryContainer } from "../repositories/repository-container.ts";
import { logger } from "../utils/logger.ts";
import { getGameById } from "../models/game.ts";

// テスト用のリセット関数
export const resetStore = async () => {
  // テストモードを強制し、既存のリポジトリインスタンスをリセットしてからクリアする
  // これにより、既に作成済みの Postgres リポジトリが残っている場合でも
  // メモリリポジトリに切り替わりデータが分離されます。
  repositoryContainer.setTestMode();
  repositoryContainer.resetRepositories();
  // 外部キー依存関係に配慮して chat_messages -> games -> users の順でクリア
  await repositoryContainer.clearAllRepositories();
  logger.info("All repositories cleared for test reset");
};

export const register = async (data: UserRegistration): Promise<User> => {
  const userRepo = repositoryContainer.getUserRepository();
  
  // メールアドレスの重複チェック
  const existingUser = await userRepo.findByEmail(data.email);
  if (existingUser) {
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

  await userRepo.add(user);
  const { password: _password, ...userWithoutPassword } = user;
  return userWithoutPassword as User;
};

export const login = async (data: Login): Promise<AuthToken> => {
  const userRepo = repositoryContainer.getUserRepository();
  const user = await userRepo.findByEmail(data.email);
  
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

export const getUserById = async (userId: string): Promise<Omit<User, "password"> | null> => {
  const userRepo = repositoryContainer.getUserRepository();
  const user = await userRepo.findById(userId);
  
  if (!user) return null;

  const { password: _password, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

// ユーザー統計の更新
export const updateUserStats = async (
  userId: string, 
  stats: Partial<User["stats"]>
): Promise<Omit<User, "password"> | null> => {
  const userRepo = repositoryContainer.getUserRepository();
  const updatedUser = await userRepo.updateStats(userId, stats);
  
  if (!updatedUser) return null;
  
  const { password: _password, ...userWithoutPassword } = updatedUser;
  return userWithoutPassword;
};

// 互換性を維持するためのヘルパー関数
export const getUserByIdSync = (_userId: string): Omit<User, "password"> | undefined => {
  // 非同期版をラップする同期APIを提供
  // 注意: テスト環境以外では使用しないことを推奨
  logger.warn("getUserByIdSync is deprecated, use async getUserById instead");
  
  // 非同期関数は同期的に値を返せないので、常にundefinedを返す
  // 実際のアプリケーションでは、この関数の代わりに非同期版を使用すべき
  return undefined;
};

export const getUserByGame = async (gameId: string, userId: string): Promise<Omit<User, "password"> | null> => {
  const userRepo = repositoryContainer.getUserRepository();
  const user = await userRepo.findById(userId);
  
  if (!user) return null;
  
  // ゲーム情報の確認（オプション）
  if (gameId) {
    const game = await getGameById(gameId);
    if (!game) return null;
    
    // ユーザーがゲームに参加しているか確認
    const isPlayerInGame = game.players.some(p => p.playerId === userId);
    if (!isPlayerInGame) return null;
  }

  const { password: _password, ...userWithoutPassword } = user;
  return userWithoutPassword;
};
