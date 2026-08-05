import { spawnSync } from "node:child_process";
import { delimiter, resolve } from "node:path";

const backendRoot = resolve("apps/backend");
const backendSrc = resolve(backendRoot, "src");
const moduleName = process.argv[2];

if (!moduleName) {
  console.error("Usage: node apps/backend/scripts/run-python-module.mjs <module> [args...]");
  process.exit(2);
}

const pythonPath = process.env.PYTHONPATH
  ? `${backendSrc}${delimiter}${process.env.PYTHONPATH}`
  : backendSrc;

const result = spawnSync(
  "uv",
  [
    "--directory",
    backendRoot,
    "run",
    "--locked",
    "python",
    "-m",
    moduleName,
    ...process.argv.slice(3),
  ],
  {
    env: { ...process.env, PYTHONPATH: pythonPath },
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
