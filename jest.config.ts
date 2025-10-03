import type { Config } from "jest";

const config: Config = {
  testEnvironment: "node",
  transform: { "^.+\\.(t|j)sx?$": ["ts-jest", { tsconfig: "tsconfig.json" }] },
  moduleFileExtensions: ["ts", "js", "json"],
  testMatch: ["**/*.test.ts"],
  clearMocks: true,
};
export default config;
