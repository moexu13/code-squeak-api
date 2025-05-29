import dotenv from "dotenv";
import logger from "../utils/logger";

// Load environment variables
const result = dotenv.config();
if (result.error) {
  logger.error({ message: "Error loading .env file", error: result.error });
}

// Configuration interface
interface Config {
  env: {
    nodeEnv: string;
    isDevelopment: boolean;
    isTest: boolean;
    isProduction: boolean;
  };
  unkey: {
    rootKey: string;
    apiId: string;
  };
  server: {
    port: number;
    host: string;
  };
  debug: boolean;
  sentry: {
    dsn: string;
    environment: string;
  };
  redis: {
    url: string;
    password?: string;
    tls?: boolean;
  };
}

// Validate required environment variables
const requiredEnvVars = [
  "NODE_ENV",
  "UNKEY_ROOT_KEY",
  "UNKEY_API_ID",
  "SENTRY_DSN",
  "REDIS_URL",
] as const;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Export configuration
export const config: Config = {
  env: {
    nodeEnv: process.env.NODE_ENV || "development",
    isDevelopment: process.env.NODE_ENV === "development",
    isTest: process.env.NODE_ENV === "test",
    isProduction: process.env.NODE_ENV === "production",
  },
  unkey: {
    rootKey: process.env.UNKEY_ROOT_KEY as string,
    apiId: process.env.UNKEY_API_ID as string,
  },
  server: {
    port: parseInt(process.env.PORT || "3000", 10),
    host: process.env.HOST || "localhost",
  },
  debug: process.env.DEBUG === "true",
  sentry: {
    dsn: process.env.SENTRY_DSN as string,
    environment: process.env.NODE_ENV || "development",
  },
  redis: {
    url: process.env.REDIS_URL as string,
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === "true",
  },
} as const;

// Type-safe config access
export type ConfigKey = keyof Config;
export type EnvKey = keyof Config["env"];
export type UnkeyKey = keyof Config["unkey"];
export type ServerKey = keyof Config["server"];
