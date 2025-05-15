import { RedisError } from "./types";
import logger from "../../../utils/logger";

export const handleRedisError = (error: unknown, context: string): void => {
  if (error instanceof Error) {
    const redisError = error as RedisError;
    logger.error(
      {
        error: {
          message: redisError.message,
          code: redisError.code,
          command: redisError.command,
          args: redisError.args,
        },
        context,
      },
      "Redis operation failed"
    );
  } else {
    logger.error({ error, context }, "Unexpected Redis error");
  }
};
