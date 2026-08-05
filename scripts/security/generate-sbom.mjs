import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "artifacts", "sbom");
const buildCommand = (program, args) =>
  process.platform === "win32"
    ? ["cmd", ["/d", "/s", "/c", [program, ...args].join(" ")]]
    : [program, args];

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? ROOT,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `${command} exited with code ${code}`));
        return;
      }
      resolve(stdout);
    });
  });

const packageNameFromLockPath = (lockPath, fallbackName) => {
  const normalized = String(lockPath || "").replaceAll("\\", "/");
  if (!normalized || normalized === "") {
    return fallbackName || "root";
  }

  const segments = normalized.split("/");
  const nodeModulesIndex = segments.lastIndexOf("node_modules");
  if (nodeModulesIndex >= 0 && nodeModulesIndex < segments.length - 1) {
    const nextSegment = segments[nodeModulesIndex + 1];
    if (String(nextSegment).startsWith("@") && nodeModulesIndex + 2 < segments.length) {
      return `${nextSegment}/${segments[nodeModulesIndex + 2]}`;
    }
    return nextSegment;
  }

  return fallbackName || segments[segments.length - 1];
};

const buildNodeSbomFallback = async (reason) => {
  const lockPath = path.join(ROOT, "package-lock.json");
  const lock = JSON.parse(await readFile(lockPath, "utf8"));
  const packages = lock.packages || {};

  const components = Object.entries(packages)
    .filter(([lockPathValue]) => lockPathValue !== "")
    .map(([lockPathValue, entry]) => {
      const name = packageNameFromLockPath(lockPathValue, entry.name);
      const version = typeof entry.version === "string" ? entry.version : "0.0.0";
      return {
        "bom-ref": `${name}@${version}`,
        type: "library",
        name,
        version,
      };
    });

  return JSON.stringify(
    {
      bomFormat: "CycloneDX",
      specVersion: "1.5",
      version: 1,
      metadata: {
        component: {
          type: "application",
          name: "silo",
          version: "workspace-lock",
        },
        properties: [
          {
            name: "fallbackReason",
            value: String(reason?.message || reason || "unknown"),
          },
        ],
      },
      components,
    },
    null,
    2,
  );
};

const main = async () => {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const [npmCommand, npmArgs] = buildCommand("npm", [
    "sbom",
    "--package-lock-only",
    "--sbom-format",
    "cyclonedx",
    "--sbom-type",
    "application",
  ]);
  let nodeSbom;
  try {
    nodeSbom = await run(npmCommand, npmArgs, { cwd: ROOT });
  } catch (error) {
    console.warn(`[sbom] npm sbom fallback engaged: ${error instanceof Error ? error.message : String(error)}`);
    nodeSbom = await buildNodeSbomFallback(error);
  }
  await writeFile(path.join(OUTPUT_DIR, "node.cdx.json"), nodeSbom, "utf8");

  const [uvCommand, uvArgs] = buildCommand("uv", [
    "--directory",
    "apps/backend",
    "export",
    "--locked",
    "--format",
    "cyclonedx1.5",
    "--all-groups",
    "--output-file",
    path.join(OUTPUT_DIR, "python.cdx.json"),
  ]);
  await run(
    uvCommand,
    uvArgs,
    { cwd: ROOT },
  );

  const [uvScopeCommand, uvScopeArgs] = buildCommand("uv", [
    "--directory",
    "apps/backend",
    "run",
    "--locked",
    "silo-sbom-contract",
    "--output-dir",
    OUTPUT_DIR,
  ]);
  await run(uvScopeCommand, uvScopeArgs, { cwd: ROOT });

  process.stdout.write(`${path.join("artifacts", "sbom", "node.cdx.json")}\n`);
  process.stdout.write(`${path.join("artifacts", "sbom", "python.cdx.json")}\n`);
  process.stdout.write(`${path.join("artifacts", "sbom", "python.api.cdx.json")}\n`);
  process.stdout.write(`${path.join("artifacts", "sbom", "python.worker.cdx.json")}\n`);
  process.stdout.write(`${path.join("artifacts", "sbom", "python.service-scopes.json")}\n`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
