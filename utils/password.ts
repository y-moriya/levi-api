import { config } from '../config.ts';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(config.password.saltRounds);
  return await bcrypt.hash(password, salt);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};