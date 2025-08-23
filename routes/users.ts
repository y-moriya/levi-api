import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import * as usersController from "../controllers/users.ts";
import { validateUserRegistration } from "../middleware/validation.ts";

const users = new Hono();

// POST /users - 新規ユーザー登録
users.post("/", validateUserRegistration, usersController.createUser);

// GET /users/:userId - ユーザー情報取得
users.get("/:userId", usersController.getUser);

export default users;
