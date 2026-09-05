import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    reporters: process.env.CI ? ["default", "json"] : ["default"],
    outputFile: process.env.CI ? { json: "reportes-prueba/unitarias.json" } : undefined,
  },
});
