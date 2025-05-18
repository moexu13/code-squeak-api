import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import analysisRouter from "../src/api/analysis/analysis.router";

describe("Analysis Endpoint", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/code-analysis", analysisRouter);

  it("should return 200 for GET request", async () => {
    const response = await request(app)
      .get("/api/v1/code-analysis")
      .expect("Content-Type", /json/)
      .expect(200);

    expect(response.body).toBeDefined();
  });
});
