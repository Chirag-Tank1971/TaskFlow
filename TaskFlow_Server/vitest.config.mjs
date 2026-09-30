import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.js"],
    // Set before any test file imports the app: NODE_ENV=test stops script.js from
    // listening on port 5000 (so `npm test` can run next to `npm run dev`)
    env: {
      NODE_ENV: "test",
      JWT_SECRET: "test-secret",
    },
  },
});
