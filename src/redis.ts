import { Redis } from "ioredis";

export async function getRedisClient(dbIndex: number): Promise<Redis> {
  if (!process.env.REDIS_URL) {
    throw new Error("Missing REDIS_URL");
  }

  const redis = new Redis(process.env.REDIS_URL, {
    family: 6,
    db: dbIndex,
  });

  return redis;
}
