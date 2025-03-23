export interface UserRegistration {
  username: string;
  email: string;
  password: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  createdAt: string;
  stats: UserStats;
}

export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  winRatio: number;
  villagerWins: number;
  werewolfWins: number;
}

export interface Login {
  email: string;
  password: string;
}

export interface AuthToken {
  token: string;
  expiresAt: string;
  user: Omit<User, 'password'>;
}