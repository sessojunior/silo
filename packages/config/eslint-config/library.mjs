import { defineConfig, globalIgnores } from "eslint/config";

/** @type {import("eslint").Linter.Config} */
const libraryConfig = [
  globalIgnores(["node_modules/**", "dist/**", "build/**"]),
  {
    rules: {
      "no-console": "warn",
    },
  },
];

export default libraryConfig;
