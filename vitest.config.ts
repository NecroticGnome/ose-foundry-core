import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.unit.test.ts"],
    setupFiles: ["./test/foundry-stub.ts"],
  },
});
