import "https://deno.land/x/dotenv@v3.2.2/load.ts";

export const config = {
  port: parseInt(Deno.env.get("PORT") || "8080"),
  env: Deno.env.get("NODE_ENV") || "development",
  version: "1.0.0",
  jwt: {
    secret: Deno.env.get("JWT_SECRET") || "fallback-secret-key-do-not-use-in-production",
    expiresIn: "24h",
  },
  password: {
    saltRounds: 10,
  },
  logging: {
    level: Deno.env.get("LOG_LEVEL") || "info",
  },
};
