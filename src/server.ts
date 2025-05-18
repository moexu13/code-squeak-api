import express from "express";
import ViteExpress from "vite-express";
import dotenv from "dotenv";

import analysisRouter from "./api/analysis/analysis.router";
import errorHandler from "./errors/errorHandler";
import notFound from "./errors/notFound";

dotenv.config();

const app = express();
app.use(express.json());

app.use(errorHandler);
app.use(notFound);

app.get("/", (_, res) => {
  res.send("Code Squeak API");
});

app.use("/api/v1/code-analysis", analysisRouter);

ViteExpress.listen(app, 3000, () =>
  console.log("Server is listening on port 3000...")
);
