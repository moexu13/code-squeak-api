import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import analysisRouter from "../src/api/analysis/analysis.routes";

describe("Analysis Endpoint", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/code-analysis", analysisRouter);

  it("should return 200 for POST request", async () => {
    const response = await request(app)
      .post("/api/v1/code-analysis")
      .send({ diff: "test diff" })
      .expect("Content-Type", /json/)
      .expect(200);

    expect(response.body).toBeDefined();
  });
});
