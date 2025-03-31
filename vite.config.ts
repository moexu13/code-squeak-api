import { defineConfig } from 'vite';
import devServer from '@hono/vite-dev-server';
import { configDefaults } from 'vitest/config';

export default defineConfig({
  plugins: [
    devServer({
      entry: './src/index.ts', // Path to your Hono app entry
      exclude: [
        // Exclude lambda-specific code from dev server
        '**/*.test.ts',
        './dist/**' 
      ]
    })
  ],
  // Vitest configuration
  test: {
    // Use threads pool for better performance
    pool: "threads",
    // Environment setup
    environment: "node",
    // Include pattern for test files
    include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}"],
    // Exclude node_modules and dist directories
    exclude: ["**/node_modules/**", "**/dist/**"],
    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
    // Silent by default, change to false if you want more verbose output
    silent: false,
  }
}); 
