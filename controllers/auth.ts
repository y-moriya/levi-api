import { Context } from 'https://deno.land/x/hono@v3.11.7/context.ts';
import * as authService from '../services/auth.ts';
import { UserRegistration, Login } from '../types/user.ts';
import { logger } from '../utils/logger.ts';

interface APIError {
  message: string;
}

export const register = async (c: Context) => {
  try {
    const data = await c.req.json() as UserRegistration;
    logger.info('Registering new user', { username: data.username, email: data.email });
    
    const user = await authService.register(data);
    logger.info('User registered successfully', { userId: user.id });
    
    return c.json(user, 201);
  } catch (error: unknown) {
    const err = error as APIError;
    if (err.message === 'Email already exists') {
      logger.warn('Registration failed - Email exists', { email: (await c.req.json() as UserRegistration).email });
      return c.json({ code: 'EMAIL_EXISTS', message: err.message }, 400);
    }
    logger.error('Registration failed', error as Error);
    throw error;
  }
};

export const login = async (c: Context) => {
  try {
    const data = await c.req.json() as Login;
    logger.info('User login attempt', { email: data.email });
    
    const authToken = await authService.login(data);
    logger.info('User logged in successfully', { userId: authToken.user.id });
    
    return c.json(authToken, 200);
  } catch (error: unknown) {
    const err = error as APIError;
    if (err.message === 'Invalid credentials') {
      logger.warn('Login failed - Invalid credentials', { email: (await c.req.json() as Login).email });
      return c.json({ code: 'INVALID_CREDENTIALS', message: err.message }, 401);
    }
    logger.error('Login failed', error as Error);
    throw error;
  }
};