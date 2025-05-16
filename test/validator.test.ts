import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateOwner,
  validateRepo,
  validatePullRequestParams,
  ValidationError,
} from "../src/utils/validator";

describe("Validator", () => {
  describe("validateOwner", () => {
    it("should accept valid owner names", () => {
      const validOwners = ["user123", "test-org", "org-name", "user123"];
      validOwners.forEach((owner) => {
        const result = validateOwner(owner);
        expect(result.isValid).toBe(true);
      });
    });

    it("should reject empty owner names", () => {
      const result = validateOwner("");
      expect(result.isValid).toBe(false);
      expect(result.error?.message).toBe("Owner parameter is required");
    });

    it("should reject owner names that are too long", () => {
      const longOwner = "a".repeat(40);
      const result = validateOwner(longOwner);
      expect(result.isValid).toBe(false);
      expect(result.error?.message).toBe("Owner parameter must be 39 characters or less");
    });

    it("should reject owner names with invalid characters", () => {
      const invalidOwners = ["user@123", "test_name", "org.name", "user space"];
      invalidOwners.forEach((owner) => {
        const result = validateOwner(owner);
        expect(result.isValid).toBe(false);
        expect(result.error?.message).toBe(
          "Owner parameter can only contain alphanumeric characters and hyphens"
        );
      });
    });
  });

  describe("validateRepo", () => {
    it("should accept valid repository names", () => {
      const validRepos = ["repo-123", "test.repo", "repo_name", "repo123"];
      validRepos.forEach((repo) => {
        const result = validateRepo(repo);
        expect(result.isValid).toBe(true);
      });
    });

    it("should reject empty repository names", () => {
      const result = validateRepo("");
      expect(result.isValid).toBe(false);
      expect(result.error?.message).toBe("Repository parameter is required");
    });

    it("should reject repository names that are too long", () => {
      const longRepo = "a".repeat(101);
      const result = validateRepo(longRepo);
      expect(result.isValid).toBe(false);
      expect(result.error?.message).toBe("Repository parameter must be 100 characters or less");
    });

    it("should reject repository names with invalid characters", () => {
      const invalidRepos = ["repo@123", "test repo", "repo#name", "test/repo"];
      invalidRepos.forEach((repo) => {
        const result = validateRepo(repo);
        expect(result.isValid).toBe(false);
        expect(result.error?.message).toBe(
          "Repository parameter can only contain alphanumeric characters, hyphens, underscores, and periods"
        );
      });
    });
  });

  describe("validatePullRequestParams middleware", () => {
    let mockContext: any;
    let mockNext: any;
    let mockJson: any;

    beforeEach(() => {
      mockJson = vi.fn();
      mockNext = vi.fn();
      mockContext = {
        req: {
          param: vi.fn(),
        },
        json: mockJson,
      };
    });

    it("should call next() for valid parameters", async () => {
      mockContext.req.param.mockReturnValue({
        owner: "valid-owner",
        repoName: "valid-repo",
        pullNumber: "123",
      });

      await validatePullRequestParams(mockContext, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockJson).not.toHaveBeenCalled();
    });

    it("should return 400 error for invalid owner", async () => {
      mockContext.req.param.mockReturnValue({
        owner: "invalid@owner",
        repoName: "valid-repo",
        pullNumber: "123",
      });

      await validatePullRequestParams(mockContext, mockNext);

      expect(mockJson).toHaveBeenCalledWith(
        {
          error: "Owner parameter can only contain alphanumeric characters and hyphens",
          success: false,
        },
        400
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 400 error for invalid repository", async () => {
      mockContext.req.param.mockReturnValue({
        owner: "valid-owner",
        repoName: "invalid@repo",
        pullNumber: "123",
      });

      await validatePullRequestParams(mockContext, mockNext);

      expect(mockJson).toHaveBeenCalledWith(
        {
          error:
            "Repository parameter can only contain alphanumeric characters, hyphens, underscores, and periods",
          success: false,
        },
        400
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should propagate unexpected errors", async () => {
      const error = new Error("Unexpected error");
      mockContext.req.param.mockImplementation(() => {
        throw error;
      });

      await expect(validatePullRequestParams(mockContext, mockNext)).rejects.toThrow(error);
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockJson).not.toHaveBeenCalled();
    });
  });
});
