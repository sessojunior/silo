#!/usr/bin/env node

const assert = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { dirname, resolve } = await import('node:path');
const { fileURLToPath } = await import('node:url');

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const inputPath = resolve(repoRoot, process.argv[2] ?? "kafka-consumer-api-example.json");

const ecflowKafkaModule = await import("../packages/engine/src/dataflow/ecflow-kafka.ts");
const parseEcflowKafkaPipelines =
  ecflowKafkaModule.parseEcflowKafkaPipelines ?? ecflowKafkaModule.default?.parseEcflowKafkaPipelines;

if (typeof parseEcflowKafkaPipelines !== "function") {
  throw new TypeError("parseEcflowKafkaPipelines is not available in the ecflow Kafka module");
}


const payload = JSON.parse(readFileSync(inputPath, "utf8"));
const pipelines = parseEcflowKafkaPipelines(payload, "smna");

assert.equal(pipelines.length, 4, "expected four pipelines from the example payload");

const summary = pipelines.map((pipeline) => ({
  model: pipeline.model,
  date: pipeline.date,
  turn: pipeline.turn,
  status: pipeline.status,
  groups: pipeline.groups.length,
}));

console.log(JSON.stringify({ count: pipelines.length, pipelines: summary }, null, 2));
