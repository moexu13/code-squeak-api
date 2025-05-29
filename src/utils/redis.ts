import { createClient } from "redis";
import type { RedisClientOptions } from "redis";
import { config } from "../config/env";
import logger from "./logger";

class RedisClient {
  private static instance: RedisClient;
  private client: ReturnType<typeof createClient>;
  private isConnected: boolean = false;

  private constructor() {
    this.client = createClient({
      url: config.redis.url,
      password: config.redis.password,
      socket: {
        tls: config.redis.tls,
        reconnectStrategy: (retries: number) => {
          if (retries > 10) {
            logger.error({
              message: "Redis max retries reached. Giving up...",
            });
            return new Error("Redis max retries reached");
          }
          return Math.min(retries * 100, 3000);
        },
      },
    } as RedisClientOptions);

    this.client.on("error", (err) => {
      logger.error({ message: "Redis Client Error", error: err });
      this.isConnected = false;
    });

    this.client.on("connect", () => {
      logger.info({ message: "Redis Client Connected" });
      this.isConnected = true;
    });

    this.client.on("reconnecting", () => {
      logger.info({ message: "Redis Client Reconnecting" });
      this.isConnected = false;
    });
  }

  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  public async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  public async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  public getClient() {
    return this.client;
  }

  public isReady(): boolean {
    return this.isConnected;
  }
}

export const redisClient = RedisClient.getInstance();
