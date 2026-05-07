import { cp, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const standaloneAppDir = path.join(projectRoot, ".next", "standalone", "apps", "web");
const standalonePublicDir = path.join(standaloneAppDir, "public");
const standaloneStaticDir = path.join(standaloneAppDir, ".next", "static");

const publicDir = path.join(projectRoot, "public");
const staticDir = path.join(projectRoot, ".next", "static");

async function copyDirectoryContents(sourceDir, destinationDir) {
  await mkdir(destinationDir, { recursive: true });

  const entries = await readdir(sourceDir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const sourcePath = path.join(sourceDir, entry.name);
      const destinationPath = path.join(destinationDir, entry.name);

      if (entry.isDirectory()) {
        await copyDirectoryContents(sourcePath, destinationPath);
        return;
      }

      await cp(sourcePath, destinationPath, { force: true });
    }),
  );
}

async function main() {
  await mkdir(path.dirname(standalonePublicDir), { recursive: true });
  await mkdir(path.dirname(standaloneStaticDir), { recursive: true });

  await copyDirectoryContents(publicDir, standalonePublicDir);
  await copyDirectoryContents(staticDir, standaloneStaticDir);
}

main().catch((error) => {
  console.error("[prepare-standalone-assets] Falha ao preparar assets do standalone:", error);
  process.exit(1);
});