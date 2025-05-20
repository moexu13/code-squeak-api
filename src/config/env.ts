import dotenv from "dotenv";
import path from "path";

// Debug the current working directory and .env path
console.log("Current working directory:", process.cwd());
console.log("Looking for .env at:", path.resolve(process.cwd(), ".env"));

// Load environment variables
const result = dotenv.config();
if (result.error) {
  console.error("Error loading .env file:", result.error);
}

// Debug logging
console.log("Environment variables loaded:", {
  UNKEY_ROOT_KEY: process.env.UNKEY_ROOT_KEY ? "set" : "not set",
  UNKEY_API_ID: process.env.UNKEY_API_ID ? "set" : "not set",
  NODE_ENV: process.env.NODE_ENV,
});

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
    rootKey: process.env.UNKEY_ROOT_KEY!,
    apiId: process.env.UNKEY_API_ID!,
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
