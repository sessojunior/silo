import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEFAULT_ALLOWLIST_PATH = path.join(
  ROOT,
  "docs",
  "migration",
  "security-node-audit-allowlist.json",
);

const runAudit = () => {
  const isWindows = process.platform === "win32";
  const command = isWindows ? "cmd" : "npm";
  const args = isWindows
    ? ["/d", "/s", "/c", "npm audit --json --audit-level=high"]
    : ["audit", "--json", "--audit-level=high"];

  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }

  return {
    exitCode: typeof result.status === "number" ? result.status : 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
};

const loadJson = async (filePath) => {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
};

const normalizeSeverity = (value) => String(value || "unknown").trim().toLowerCase();

const formatList = (values) => (values.length === 0 ? "-" : values.join(", "));

const main = async () => {
  const allowlistPath = process.env.NODE_AUDIT_ALLOWLIST_PATH || DEFAULT_ALLOWLIST_PATH;
  const allowlist = await loadJson(allowlistPath);
  const allowlistedPackages = new Map(
    Object.entries(allowlist.packages || {}).map(([name, entry]) => [name, entry || {}]),
  );

  const audit = runAudit();
  const auditOutput = audit.stdout.trim() || audit.stderr.trim();
  if (!auditOutput) {
    throw new Error("npm audit did not return parsable JSON.");
  }

  const report = JSON.parse(auditOutput);
  const vulnerabilities =
    report.vulnerabilities && typeof report.vulnerabilities === "object"
      ? report.vulnerabilities
      : {};

  const blocking = [];
  const allowed = [];
  const lowerSeverity = [];

  for (const [name, entry] of Object.entries(vulnerabilities)) {
    const severity = normalizeSeverity(entry?.severity);
    const location = entry?.range ? `${name} (${entry.range})` : name;

    if (severity !== "high" && severity !== "critical") {
      lowerSeverity.push(location);
      continue;
    }

    const allowlistEntry = allowlistedPackages.get(name);
    if (!allowlistEntry) {
      blocking.push({
        name,
        severity,
        location,
        fixAvailable: entry?.fixAvailable ?? null,
      });
      continue;
    }

    allowed.push({
      name,
      severity,
      reason: String(allowlistEntry.reason || "no reason provided").trim(),
    });
  }

  const counts = report.metadata?.vulnerabilities || {};
  const totalHighCritical = Number(counts.high || 0) + Number(counts.critical || 0);

  if (lowerSeverity.length > 0) {
    console.log(`[node-audit] lower-severity findings observed: ${formatList(lowerSeverity)}`);
  }

  if (allowed.length > 0) {
    console.log(
      `[node-audit] allowlisted high/critical findings: ${allowed
        .map((item) => `${item.name} (${item.severity})`)
        .join(", ")}`,
    );
  }

  if (blocking.length > 0) {
    console.error("[node-audit] blocked high/critical findings:");
    for (const item of blocking) {
      const fixText = item.fixAvailable === true ? " fix available" : "";
      console.error(`- ${item.location} [${item.severity}]${fixText}`);
    }
    console.error(`[node-audit] allowlist path: ${path.relative(ROOT, allowlistPath)}`);
    return 1;
  }

  console.log(
    `[node-audit] ok: ${allowed.length} allowlisted high/critical findings, ${lowerSeverity.length} lower-severity findings, total high/critical reported=${totalHighCritical}`,
  );
  if (audit.exitCode !== 0) {
    console.log(
      `[node-audit] npm audit exited with code ${audit.exitCode} as expected for allowlisted findings.`,
    );
  }
  return 0;
};

main()
  .then((code) => {
    if (code !== 0) {
      process.exitCode = code;
    }
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 1;
  });
