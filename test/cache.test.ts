import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { redisClient } from "../src/utils/redis";
import { getCached, setCached, generateCacheKey } from "../src/utils/cache";
import { list, read, getDiff } from "../src/api/github/github.service";
import {
  PaginatedResponse,
  Repository,
  PullRequest,
} from "../src/api/github/github.types";

// Mock Octokit
vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    repos: {
      listForUser: vi.fn().mockResolvedValue({
        data: [
          {
            id: 1,
            name: "test-repo",
            full_name: "test-owner/test-repo",
            description: "Test repository",
            html_url: "https://github.com/test-owner/test-repo",
            updated_at: new Date().toISOString(),
            stargazers_count: 0,
            language: "TypeScript",
          },
        ],
        headers: {
          link: '<https://api.github.com/user/repos?page=1>; rel="last"',
        },
      }),
    },
    pulls: {
      list: vi.fn().mockResolvedValue({
        data: [
          {
            id: 1,
            number: 123,
            title: "Test PR",
            user: { login: "testuser" },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            body: "Test PR body",
          },
        ],
        headers: {
          link: '<https://api.github.com/repos/test-owner/test-repo/pulls?page=1>; rel="last"',
        },
      }),
      get: vi.fn().mockResolvedValue({
        data: {
          comments: 5,
          additions: 10,
          deletions: 5,
        },
      }),
    },
    request: vi.fn().mockResolvedValue({
      data: "diff content",
    }),
  })),
}));

describe("GitHub Service Caching", () => {
  beforeAll(async () => {
    await redisClient.connect();
  });

  afterAll(async () => {
    await redisClient.disconnect();
  });

  beforeEach(async () => {
    // Clear all cache keys before each test
    const client = redisClient.getClient();
    const keys = await client.keys("github:*");
    if (keys.length > 0) {
      await client.del(keys);
    }
  });

  describe("Repository List Caching", () => {
    it("should cache repository list results", async () => {
      // First call should hit the API
      const firstResult = await list("test-owner");
      expect(firstResult.data).toHaveLength(1);

      // Second call should use cache
      const secondResult = await list("test-owner");
      expect(secondResult.data).toHaveLength(1);

      // Verify the cache key exists
      const cacheKey = generateCacheKey("github:repos", {
        owner: "test-owner",
        page: 1,
        per_page: 10,
      });
      const cached = await getCached<PaginatedResponse<Repository>>(cacheKey);
      expect(cached).toBeDefined();
      expect(cached?.data).toHaveLength(1);
    });

    it("should use different cache keys for different pagination params", async () => {
      await list("test-owner", { page: 1, per_page: 5 });
      await list("test-owner", { page: 2, per_page: 5 });

      const client = redisClient.getClient();
      const keys = await client.keys("github:repos:*");
      expect(keys).toHaveLength(2);
    });
  });

  describe("Pull Request List Caching", () => {
    it("should cache pull request list results", async () => {
      // First call should hit the API
      const firstResult = await read("test-owner", "test-repo");
      expect(firstResult).toHaveLength(1);

      // Second call should use cache
      const secondResult = await read("test-owner", "test-repo");
      expect(secondResult).toHaveLength(1);

      // Verify the cache keys exist
      const listCacheKey = generateCacheKey("github:pulls", {
        owner: "test-owner",
        repo: "test-repo",
        page: 1,
        per_page: 10,
      });
      const detailsCacheKey = generateCacheKey("github:pr-details", {
        owner: "test-owner",
        repo: "test-repo",
        number: 123,
      });

      const cachedList = await getCached<PaginatedResponse<PullRequest>>(
        listCacheKey
      );
      const cachedDetails = await getCached<{
        comments: number;
        additions: number;
        deletions: number;
      }>(detailsCacheKey);

      expect(cachedList).toBeDefined();
      expect(cachedDetails).toBeDefined();
    });
  });

  describe("Diff Caching", () => {
    it("should cache diff results", async () => {
      // First call should hit the API
      const firstResult = await getDiff("test-owner", "test-repo", 123);
      expect(firstResult).toBe("diff content");

      // Second call should use cache
      const secondResult = await getDiff("test-owner", "test-repo", 123);
      expect(secondResult).toBe("diff content");

      // Verify the cache key exists
      const cacheKey = generateCacheKey("github:diff", {
        owner: "test-owner",
        repo: "test-repo",
        number: 123,
      });
      const cached = await getCached<string>(cacheKey);
      expect(cached).toBe("diff content");
    });

    it("should use different cache keys for different PRs", async () => {
      await getDiff("test-owner", "test-repo", 123);
      await getDiff("test-owner", "test-repo", 456);

      const client = redisClient.getClient();
      const keys = await client.keys("github:diff:*");
      expect(keys).toHaveLength(2);
    });
  });

  describe("Cache TTL", () => {
    it("should respect cache TTL", async () => {
      // Set a short TTL for testing
      const shortTTL = 1; // 1 second

      // First call
      const result = await list("test-owner");

      // Manually set cache with short TTL
      const cacheKey = generateCacheKey("github:repos", {
        owner: "test-owner",
        page: 1,
        per_page: 10,
      });
      await setCached(cacheKey, result, shortTTL);

      // Verify cache exists
      const cached = await getCached<PaginatedResponse<Repository>>(cacheKey);
      expect(cached).toBeDefined();

      // Wait for cache to expire
      await new Promise((resolve) =>
        setTimeout(resolve, (shortTTL + 0.1) * 1000)
      );

      // Cache should be expired
      const expiredCache = await getCached<PaginatedResponse<Repository>>(
        cacheKey
      );
      expect(expiredCache).toBeNull();
    });
  });
});
