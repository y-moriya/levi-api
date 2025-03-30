import { create, verify } from "https://deno.land/x/djwt@v2.9.1/mod.ts";
import { config } from "../config.ts";

const encoder = new TextEncoder();
const keyBuf = encoder.encode(config.jwt.secret);
const key = await crypto.subtle.importKey(
  "raw",
  keyBuf,
  { name: "HMAC", hash: "SHA-256" },
  true,
  ["sign", "verify"],
);

export const createJwt = async (payload: { sub: string }): Promise<string> => {
  const jwt = await create(
    { alg: "HS256", typ: "JWT" },
    { ...payload, exp: getExpirationTime() },
    key,
  );
  return jwt;
};

export const verifyJwt = async (token: string): Promise<{ sub: string }> => {
  try {
    const payload = await verify(token, key);
    return payload as { sub: string };
  } catch (_error) {
    throw new Error("Invalid token");
  }
};

const getExpirationTime = (): number => {
  const expiresIn = config.jwt.expiresIn;
  const hours = parseInt(expiresIn.replace("h", ""));
  return Math.floor(Date.now() / 1000) + hours * 60 * 60;
};
