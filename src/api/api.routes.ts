import { Hono } from "hono";

const gh_app = new Hono();

gh_app.get("/", (c) => {
  return c.text("gh router");
});

export default gh_app;
