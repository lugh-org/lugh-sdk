import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "https://partner.example/",
      },
    },
    include: ["tests/**/*.test.{ts,tsx}"],
    globals: false,
  },
});
