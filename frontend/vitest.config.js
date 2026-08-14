import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.js"],

    include: [
      "src/test/**/*.test.{js,jsx}",
      "src/test/**/*.spec.{js,jsx}",
    ],

    exclude: [
      "node_modules/**",
      "dist/**",
      "coverage/**",
      "e2e/**",
    ],

    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      exclude: [
        "node_modules/**",
        "dist/**",
        "coverage/**",
        "e2e/**",
        "src/test/**",
      ],
    },
  },
});
