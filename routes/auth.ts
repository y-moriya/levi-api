import { Hono } from 'https://deno.land/x/hono@v3.11.7/mod.ts';
import * as authController from '../controllers/auth.ts';
import { validateUserRegistration, validateLogin } from '../middleware/validation.ts';

const auth = new Hono();

auth.post('/register', validateUserRegistration, authController.register);
auth.post('/login', validateLogin, authController.login);

export default auth;