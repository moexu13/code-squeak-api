import { Hono } from "hono";
import { handle } from "hono/aws-lambda";
import { Context, Next } from "hono";
import apiRouter from "./api/api.routes";
import { config } from "dotenv";
import logger from "./utils/logger";

// Load environment variables
config();

type Variables = {
  apiKey: string;
  repoName: string;
};

const app = new Hono<{ Variables: Variables }>();

// Root route
app.get("/", (c: Context) => {
  logger.info({ context: "App" }, "Root route accessed");
  return c.text("Hello Hono!");
});

// Mount the API routes
app.route("/v1/api", apiRouter);

if (import.meta.env.DEV) {
  logger.info({ context: "App" }, "🔥 Dev server started");
}

// Export the app for testing
export { app };

// Export the handler for AWS Lambda
export const handler = handle(app);

// Add default export for Vite dev server
export default app;
