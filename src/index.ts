import { Hono } from "hono";
import { handle } from "hono/aws-lambda";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

if (import.meta.env.DEV) {
  console.log('🔥 Dev server started');
}

// Export the app for testing
export { app };

// Export the handler for AWS Lambda
export const handler = handle(app);

// Add default export for Vite dev server
export default app;
