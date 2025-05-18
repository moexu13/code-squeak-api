import express from "express";
import ViteExpress from "vite-express";

const app = express();

app.get("/", (_, res) => {
  res.send("Code Squeak API");
});

ViteExpress.listen(app, 3000, () =>
  console.log("Server is listening on port 3000...")
);
