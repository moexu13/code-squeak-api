import dotenv from "dotenv";
import logger from "../utils/logger";

// Load environment variables
const result = dotenv.config();
if (result.error) {
  logger.error({ error: result.error }, "Error loading .env file");
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
}

// Validate required environment variables
const requiredEnvVars = ["NODE_ENV", "UNKEY_ROOT_KEY", "UNKEY_API_ID"] as const;

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
} as const;

// Type-safe config access
export type ConfigKey = keyof Config;
export type EnvKey = keyof Config["env"];
export type UnkeyKey = keyof Config["unkey"];
export type ServerKey = keyof Config["server"];
