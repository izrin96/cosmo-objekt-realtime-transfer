import { createClient } from "redis";
import { env } from "../env";

export const redis = createClient({
  url: env.REDIS_URL,
});

redis.on("error", (err) => console.error("Redis Client Error", err));

export async function connectRedis() {
  await redis.connect();
}

export const TRANSFER_HISTORY_KEY = "transfer:history";
export const MAX_HISTORY = 50;
