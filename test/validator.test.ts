import { describe, it, expect, vi } from "vitest";
import {
  validateOwner,
  validateRepo,
  validatePullRequestParams,
  ValidationError,
} from "../src/utils/validator";

describe("Validator", () => {
  describe("validateOwner", () => {
    it("should accept valid owner names", () => {
      const validOwners = ["user123", "org-name", "test", "a1b2c3"];
      validOwners.forEach((owner) => {
        expect(() => validateOwner(owner)).not.toThrow();
      });
    });

    it("should reject empty owner names", () => {
      expect(() => validateOwner("")).toThrow(ValidationError);
      expect(() => validateOwner("")).toThrow("Owner parameter is required");
    });

    it("should reject owner names that are too long", () => {
      const longOwner = "a".repeat(40);
      expect(() => validateOwner(longOwner)).toThrow(ValidationError);
      expect(() => validateOwner(longOwner)).toThrow(
        "Owner parameter must be 39 characters or less"
      );
    });

    it("should reject owner names with invalid characters", () => {
      const invalidOwners = ["user@123", "test_name", "org.name", "user space"];
      invalidOwners.forEach((owner) => {
        expect(() => validateOwner(owner)).toThrow(ValidationError);
        expect(() => validateOwner(owner)).toThrow(
          "Owner parameter can only contain alphanumeric characters and hyphens"
        );
      });
    });
  });

  describe("validateRepo", () => {
    it("should accept valid repository names", () => {
      const validRepos = ["repo123", "test-repo", "my_project", "test.project", "repo-123_test.js"];
      validRepos.forEach((repo) => {
        expect(() => validateRepo(repo)).not.toThrow();
      });
    });

    it("should reject empty repository names", () => {
      expect(() => validateRepo("")).toThrow(ValidationError);
      expect(() => validateRepo("")).toThrow("Repository parameter is required");
    });

    it("should reject repository names that are too long", () => {
      const longRepo = "a".repeat(101);
      expect(() => validateRepo(longRepo)).toThrow(ValidationError);
      expect(() => validateRepo(longRepo)).toThrow(
        "Repository parameter must be 100 characters or less"
      );
    });

    it("should reject repository names with invalid characters", () => {
      const invalidRepos = ["repo@123", "test repo", "repo#name", "test/repo"];
      invalidRepos.forEach((repo) => {
        expect(() => validateRepo(repo)).toThrow(ValidationError);
        expect(() => validateRepo(repo)).toThrow(
          "Repository parameter can only contain alphanumeric characters, hyphens, underscores, and periods"
        );
      });
    });
  });

  describe("validatePullRequestParams middleware", () => {
    it("should call next() for valid parameters", async () => {
      const mockContext = {
        req: {
          param: () => ({ owner: "validuser", repoName: "valid-repo" }),
        },
        json: vi.fn(),
      };
      const mockNext = vi.fn();

      await validatePullRequestParams(mockContext as any, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it("should return 400 error for invalid owner", async () => {
      const mockJson = vi.fn();
      const mockContext = {
        req: {
          param: () => ({ owner: "invalid@user", repoName: "valid-repo" }),
        },
        json: mockJson,
      };
      const mockNext = vi.fn();

      await validatePullRequestParams(mockContext as any, mockNext);

      expect(mockJson).toHaveBeenCalledWith(
        { error: "Owner parameter can only contain alphanumeric characters and hyphens" },
        400
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 400 error for invalid repository", async () => {
      const mockJson = vi.fn();
      const mockContext = {
        req: {
          param: () => ({ owner: "validuser", repoName: "invalid@repo" }),
        },
        json: mockJson,
      };
      const mockNext = vi.fn();

      await validatePullRequestParams(mockContext as any, mockNext);

      expect(mockJson).toHaveBeenCalledWith(
        {
          error:
            "Repository parameter can only contain alphanumeric characters, hyphens, underscores, and periods",
        },
        400
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should propagate unexpected errors", async () => {
      const unexpectedError = new Error("Unexpected error");
      const mockContext = {
        req: {
          param: () => {
            throw unexpectedError;
          },
        },
        json: vi.fn(),
      };
      const mockNext = vi.fn();

      await expect(validatePullRequestParams(mockContext as any, mockNext)).rejects.toThrow(
        unexpectedError
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
