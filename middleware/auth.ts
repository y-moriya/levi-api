import { Context } from "https://deno.land/x/hono@v3.11.7/context.ts";
import type { MiddlewareHandler } from "https://deno.land/x/hono@v3.11.7/types.ts";
import { verifyJwt } from "../utils/jwt.ts";
import * as authService from "../services/auth.ts";

export const authMiddleware: MiddlewareHandler = async (c: Context, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ code: "UNAUTHORIZED", message: "Authentication required" }, 401);
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = await verifyJwt(token);
    const user = authService.getUserById(payload.sub);

    if (!user) {
      return c.json({ code: "UNAUTHORIZED", message: "User not found" }, 401);
    }

    c.set("userId", payload.sub);
    await next();
  } catch (_error) {
    return c.json({ code: "INVALID_TOKEN", message: "Invalid or expired token" }, 401);
  }
};
