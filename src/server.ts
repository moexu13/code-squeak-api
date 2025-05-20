import express from "express";
import ViteExpress from "vite-express";
import dotenv from "dotenv";

import analysisRouter from "./api/analysis/analysis.router";
import errorHandler from "./errors/errorHandler";
import notFound from "./errors/notFound";
import authMiddleware from "./middleware/auth";

dotenv.config();

const app = express();
app.use(express.json());

// Root route should be first
app.get("/", (_, res) => {
  res.send("Code Squeak API");
});

// API routes with auth
app.use("/api/v1", authMiddleware);
app.use("/api/v1/code-analysis", analysisRouter);

// Error handling should be last
app.use(notFound);
app.use(errorHandler);

ViteExpress.listen(app, 3000, () =>
  console.log("Server is listening on port 3000...")
);
