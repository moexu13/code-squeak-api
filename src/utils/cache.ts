import { redisClient } from "./redis";
import logger from "./logger";

const DEFAULT_CACHE_TTL = 60 * 5; // 5 minutes in seconds

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const cached = await redisClient.getClient().get(key);
    if (!cached) return null;
    return JSON.parse(cached) as T;
  } catch (error) {
    logger.error({
      message: "Failed to get cached data",
      error: error instanceof Error ? error : new Error(String(error)),
      key,
    });
    return null;
  }
}

export async function setCached<T>(
  key: string,
  data: T,
  ttl: number = DEFAULT_CACHE_TTL
): Promise<void> {
  try {
    await redisClient.getClient().set(key, JSON.stringify(data), {
      EX: ttl,
    });
  } catch (error) {
    logger.error({
      message: "Failed to cache data",
      error: error instanceof Error ? error : new Error(String(error)),
      key,
    });
  }
}

export function generateCacheKey(
  prefix: string,
  params: Record<string, any>
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}:${params[key]}`)
    .join(":");
  return `${prefix}:${sortedParams}`;
}
