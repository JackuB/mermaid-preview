import { Redis } from "ioredis";

export async function getRedisClient(dbIndex: number): Promise<Redis> {
  if (!process.env.REDIS_URL) {
    throw new Error("Missing REDIS_URL");
  }

  const redis = new Redis(process.env.REDIS_URL, {
    family: 6,
    db: dbIndex,
  });
  redis.on("connect", () => console.info("redis: connected"));
  redis.on("ready", () => console.info("redis: ready"));
  redis.on("error", (err) => console.error("redis: error", err));
  redis.on("close", () => console.warn("redis: connection closed"));
  redis.on("reconnecting", (delay: number) =>
    console.warn("redis: reconnecting in", delay, "ms")
  );

  return redis;
}
