import { logger } from "../../utils/logger.ts";

export async function consumeResponse<T>(response: Response): Promise<T> {
  try {
    const data = await response.json();

    if (!response.ok) {
      const err = new Error(`HTTP error! status: ${response.status}`);
      logger.error("HTTP error response", err, { statusCode: response.status, responseData: data });

      let mappedStatus = response.status;
      if (data && typeof data === "object" && "code" in data) {
        const errorCode = (data as any).code;
        if (errorCode === "EMAIL_EXISTS" || errorCode === "VALIDATION_ERROR") mappedStatus = 400;
        else if (["INVALID_CREDENTIALS", "TOKEN_EXPIRED", "TOKEN_INVALID"].includes(errorCode)) mappedStatus = 401;
        else if (["NOT_FOUND", "GAME_NOT_FOUND"].includes(errorCode)) mappedStatus = 404;
      } else if (typeof data === "object" && (data as any).message) {
        const msg = (data as any).message as string;
        if (msg.includes("このメールアドレスは既に登録") || msg.includes("Invalid") || msg.includes("リクエストデータが無効")) mappedStatus = 400;
        else if (msg.includes("無効なメール") || msg.includes("パスワード")) mappedStatus = 401;
      }

      Object.defineProperty(response, "status", { value: mappedStatus, writable: false });
      Object.assign(err, { response: data });
      throw err;
    }

    if (isActionResponse(data)) {
      if (typeof (data as any).success !== "boolean") throw new Error("Invalid ActionResponse: success must be boolean");
      if (typeof (data as any).message !== "string") throw new Error("Invalid ActionResponse: message must be string");
    }
    return data as T;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Failed to consume response", err);
    throw error;
  }
}

function isActionResponse(data: unknown): boolean {
  return data !== null && typeof data === "object" && "success" in data && "message" in data;
}
