import { z } from "zod/v4";

const envSchema = z.object({
  INDEXER_PROXY_KEY: z.string(),
  INDEXER_PROXY_URL: z.string(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
});

export const env = envSchema.parse(process.env);
