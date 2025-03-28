import { Hono } from "hono";
import { handle } from "hono/aws-lambda";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

// Export the app for testing
export { app };

// Create a handler function by passing the Hono app to the handle function
export const handler = handle(app);
