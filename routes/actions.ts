import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import { vote, attack, divine, guard } from "../controllers/actions.ts";
import { authMiddleware } from "../middleware/auth.ts";
import { createValidationMiddleware } from "../middleware/validation.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const router = new Hono();

// すべてのルートに認証を適用
router.use("*", authMiddleware);

// アクション用のバリデーション
const actionSchema = z.object({
  targetPlayerId: z.string().uuid({ message: "Invalid target player ID format" })
});

const actionValidation = createValidationMiddleware(actionSchema);

// 投票
router.post("/:gameId/vote", actionValidation, vote);

// 襲撃
router.post("/:gameId/attack", actionValidation, attack);

// 占い
router.post("/:gameId/divine", actionValidation, divine);

// 護衛
router.post("/:gameId/guard", actionValidation, guard);

export default router;