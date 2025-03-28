import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Use threads pool for better performance
    pool: "threads",
    // Environment setup
    environment: "node",
    // Include pattern for test files
    include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}"],
    // Exclude node_modules and dist directories
    exclude: ["**/node_modules/**", "**/dist/**"],
    // Global setup, if needed
    // globalSetup: ["./test/setup.ts"],
    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
    // Silent by default, change to false if you want more verbose output
    silent: false,
  },
});
