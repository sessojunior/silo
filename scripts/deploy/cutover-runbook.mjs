import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const DEFAULT_OUTPUT_DIR = path.join(ROOT, "artifacts", "deploy");

const PHASE_15_STEPS = [
  {
    id: "15.1",
    title: "Restaurar copia recente e sanitizada de producao em staging",
    commandKey: "restoreStaging",
  },
  {
    id: "15.2",
    title: "Executar migrate, verificar head/fingerprint e iniciar API Python",
    commandKey: "startPythonApi",
  },
  {
    id: "15.3",
    title: "Manter worker Node, apontar web staging para API Python e executar smoke/e2e",
    commandKey: "switchWebToPythonAndSmoke",
  },
  {
    id: "15.4",
    title: "Validar login de contas existentes, reset de sessao e re-login",
    commandKey: "validateLogins",
  },
  {
    id: "15.5",
    title: "Capturar offsets e lag do worker Node por topico/partition",
    commandKey: "captureNodeLag",
  },
  {
    id: "15.6",
    title: "Enviar SIGTERM ao worker Node, aguardar in-flight=0 e consumer REST deletado",
    commandKey: "stopNodeWorker",
  },
  {
    id: "15.7",
    title: "Iniciar worker Python com o mesmo group id e processar lote controlado",
    commandKey: "startPythonWorker",
  },
  {
    id: "15.8",
    title: "Validar tabelas dedup, side effects, DLQ e lag",
    commandKey: "validateDedupAndLag",
  },
  {
    id: "15.9",
    title: "Executar rollback ensaiado",
    commandKey: "rollbackDrill",
  },
  {
    id: "15.10",
    title: "Reexecutar cutover para Python e manter staging por 7 dias",
    commandKey: "reCutoverAndHold",
  },
  {
    id: "15.11",
    title: "Iniciar assistente em deterministic e executar corpus, e2e e carga controlada",
    commandKey: "assistantDeterministicRehearsal",
  },
  {
    id: "15.12",
    title: "Executar coortes hybrid 5%, 25% e 100% se o Gate 11.60 estiver aprovado",
    commandKey: "hybridCohorts",
  },
  {
    id: "15.13",
    title: "Comparar planos, tools, sourceKinds, citations, artefatos e metricas",
    commandKey: "compareHybridMetrics",
  },
];

const PHASE_16_STEPS = [
  {
    id: "16.1",
    title: "Declarar inicio e congelar deploys",
    commandKey: "freezeDeploys",
  },
  {
    id: "16.2",
    title: "Registrar metricas baseline",
    commandKey: "captureBaseline",
  },
  {
    id: "16.3",
    title: "Fazer backup final e validar arquivo/listagem",
    commandKey: "backupFinal",
  },
  {
    id: "16.4",
    title: "Construir ou puxar imagens ja testadas",
    commandKey: "pullPinnedImages",
  },
  {
    id: "16.5",
    title: "Executar migrate e exigir exit 0, head e fingerprint",
    commandKey: "runMigrate",
  },
  {
    id: "16.6",
    title: "Executar ollama-init com modelos e digests aprovados",
    commandKey: "runOllamaInit",
  },
  {
    id: "16.7",
    title: "Subir API Python em paralelo e testar health/status/smoke interno",
    commandKey: "startPythonApiSmoke",
  },
  {
    id: "16.8",
    title: "Confirmar AI_AGENT_MODE explicito",
    commandKey: "confirmAiMode",
  },
  {
    id: "16.9",
    title: "Trocar web ou ingress para API Python",
    commandKey: "switchIngress",
  },
  {
    id: "16.10",
    title: "Expirar cookies Better Auth e confirmar login Python",
    commandKey: "refreshAuthSmoke",
  },
  {
    id: "16.11",
    title: "Testar GET, mutation reversivel, upload/download, PDF, WebSocket e SSE",
    commandKey: "fullSmoke",
  },
  {
    id: "16.12",
    title: "Parar worker Node com SIGTERM e aguardar in-flight zero",
    commandKey: "stopNodeWorker",
  },
  {
    id: "16.13",
    title: "Registrar offsets confirmados",
    commandKey: "recordOffsets",
  },
  {
    id: "16.14",
    title: "Subir worker Python com o mesmo group id e topicos",
    commandKey: "startPythonWorker",
  },
  {
    id: "16.15",
    title: "Confirmar primeiros offsets, dedup e estabilidade do lag",
    commandKey: "verifyLag",
  },
  {
    id: "16.16",
    title: "Observar intensivamente por 2 h e depois por 24 h",
    commandKey: "observeWindow",
  },
];

const PHASE_16_ROLLBACK_STEPS = [
  {
    id: "rollback.1",
    title: "Se o incidente for exclusivamente do modo hybrid, mudar para deterministic",
    commandKey: "rollbackDeterministic",
  },
  {
    id: "rollback.2",
    title: "Se houver risco de dados, parar novas mutations",
    commandKey: "stopMutations",
  },
  {
    id: "rollback.3",
    title: "Parar worker Python graciosamente e registrar offset final",
    commandKey: "stopPythonWorker",
  },
  {
    id: "rollback.4",
    title: "Iniciar worker Node com o mesmo group id",
    commandKey: "startNodeWorker",
  },
  {
    id: "rollback.5",
    title: "Retirar API Python da rota e recolocar API Node",
    commandKey: "switchBackToNode",
  },
  {
    id: "rollback.6",
    title: "Manter frontend dual-cookie e SSE",
    commandKey: "verifyDualRuntimeAuth",
  },
  {
    id: "rollback.7",
    title: "Nao executar downgrade Alembic automatico",
    commandKey: "skipDowngrade",
  },
  {
    id: "rollback.8",
    title: "Validar health, auth, mutation, Kafka, arquivos e assistente",
    commandKey: "rollbackSmoke",
  },
  {
    id: "rollback.9",
    title: "Nao apagar historico nem procurar checkpoint LangGraph",
    commandKey: "preserveHistory",
  },
  {
    id: "rollback.10",
    title: "Abrir incidente com timeline, versions e trajetoria sanitizada",
    commandKey: "openIncident",
  },
];

function parseArgs(argv) {
  const result = {
    mode: "preflight",
    statePath: process.env.PHASE16_STATE_PATH ?? "",
    outputDir: process.env.PHASE16_OUTPUT_DIR ?? DEFAULT_OUTPUT_DIR,
    execute: false,
  };

  const tokens = [...argv];
  while (tokens.length > 0) {
    const token = tokens.shift();
    if (token === undefined) {
      continue;
    }
    if (token === "--state") {
      result.statePath = String(tokens.shift() ?? "");
      continue;
    }
    if (token === "--output-dir") {
      result.outputDir = String(tokens.shift() ?? DEFAULT_OUTPUT_DIR);
      continue;
    }
    if (token === "--execute") {
      result.execute = true;
      continue;
    }
    if (token === "--dry-run") {
      result.execute = false;
      continue;
    }
    if (!token.startsWith("--") && result.mode === "preflight") {
      result.mode = token;
    }
  }

  return result;
}

async function readJsonFile(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asBoolean(value) {
  return value === true;
}

function asNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function resolveCommand(state, commandKey) {
  if (!isPlainObject(state)) {
    return null;
  }
  const commands = isPlainObject(state.commands) ? state.commands : null;
  const directCommand = asNonEmptyString(commands?.[commandKey]);
  if (directCommand) {
    return directCommand;
  }
  return asNonEmptyString(state[commandKey]);
}

function buildStepDescriptors(steps) {
  return steps.map((step) => ({
    id: step.id,
    title: step.title,
    commandKey: step.commandKey,
    command: null,
  }));
}

function buildPhase15Steps() {
  return buildStepDescriptors(PHASE_15_STEPS);
}

function buildPhase16Steps() {
  return buildStepDescriptors(PHASE_16_STEPS);
}

function buildPhase16RollbackSteps() {
  return buildStepDescriptors(PHASE_16_ROLLBACK_STEPS);
}

function validatePrerequisites(state) {
  const checklist = isPlainObject(state.goNoGo) ? state.goNoGo : {};
  const issues = [];

  if (!asBoolean(checklist.backupRecentWithin7Days)) {
    issues.push("Backup feito e restore testado nos ultimos 7 dias.");
  }
  if (!asBoolean(checklist.restoreTestedWithin7Days)) {
    issues.push("Restore testado nos ultimos 7 dias.");
  }
  if (!asNonEmptyString(checklist.nodeImageDigest)) {
    issues.push("Digest imutavel da imagem Node ausente.");
  }
  if (!asNonEmptyString(checklist.pythonImageDigest)) {
    issues.push("Digest imutavel da imagem Python ausente.");
  }
  if (!asBoolean(checklist.rollbackAccessAvailable)) {
    issues.push("Acesso para trocar route/Compose e contatos de rollback indisponiveis.");
  }
  if (!asBoolean(checklist.noDestructiveMigration)) {
    issues.push("Migracao destrutiva ainda presente ou nao validada como ausente.");
  }
  if (!asBoolean(checklist.noOpenIncidents)) {
    issues.push("Ha incidentes abertos de DB/Kafka/Ollama/SMTP.");
  }
  if (!asNonEmptyString(checklist.finalAiAgentMode)) {
    issues.push("AI_AGENT_MODE final nao informado.");
  }
  if (!asNonEmptyString(checklist.aiGraphVersion)) {
    issues.push("AI_GRAPH_VERSION ausente.");
  }
  if (!asNonEmptyString(checklist.promptVersion)) {
    issues.push("Prompt version ausente.");
  }
  if (!asNonEmptyString(checklist.toolCatalogVersion)) {
    issues.push("Tool catalog version ausente.");
  }
  if (!asNonEmptyString(checklist.ollamaImageDigest)) {
    issues.push("Digest da imagem Ollama ausente.");
  }
  if (!asNonEmptyString(checklist.chatModelDigest)) {
    issues.push("Digest do modelo de chat ausente.");
  }
  if (!asNonEmptyString(checklist.embeddingModelDigest)) {
    issues.push("Digest do modelo de embedding ausente.");
  }
  if (!(
    checklist.hybridGateApproved === true || checklist.hybridGateDisabled === true
  )) {
    issues.push("Gate 11 ainda nao foi marcado como aprovado ou desabilitado para hybrid.");
  }
  if (!asBoolean(checklist.usersNotified)) {
    issues.push("Usuarios ainda nao foram avisados sobre relogin e OTP.");
  }
  if (!asBoolean(checklist.lowTrafficWindowApproved)) {
    issues.push("Janela de baixa atividade ainda nao foi aprovada.");
  }

  return issues;
}

function describeStep(step, state) {
  const command = resolveCommand(state, step.commandKey);
  return {
    id: step.id,
    title: step.title,
    commandKey: step.commandKey,
    command,
  };
}

async function runShellCommand(command) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd: ROOT,
      env: process.env,
      shell: true,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
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
    child.on("exit", (code, signal) => {
      resolve({
        code: code ?? -1,
        signal: signal ?? null,
        stdout,
        stderr,
      });
    });
  });
}

async function runStep(step, state, execute) {
  const command = resolveCommand(state, step.commandKey);
  const base = {
    id: step.id,
    title: step.title,
    commandKey: step.commandKey,
    command,
  };

  if (!execute) {
    return {
      ...base,
      status: command ? "manual" : "manual-missing-command",
    };
  }

  if (!command) {
    throw new Error(
      `Falta comando para executar ${step.id} (${step.title}). Use --dry-run ou configure state.commands.${step.commandKey}.`,
    );
  }

  const startedAt = new Date().toISOString();
  const result = await runShellCommand(command);
  const finishedAt = new Date().toISOString();
  if (result.code !== 0) {
    throw new Error(
      `Falha em ${step.id} (${step.title}) com exit code ${result.code}${result.stderr ? `: ${result.stderr.trim()}` : ""}`,
    );
  }

  return {
    ...base,
    status: "passed",
    startedAt,
    finishedAt,
    exitCode: result.code,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function printPlan(mode, steps, execute) {
  process.stdout.write(`phase-16-runbook: mode=${mode} execute=${execute ? "yes" : "no"}\n`);
  for (const step of steps) {
    const commandLabel = step.command ?? "<manual>";
    process.stdout.write(`- ${step.id} ${step.title} :: ${commandLabel}\n`);
  }
}

async function writeArtifact(outputDir, mode, payload) {
  await mkdir(outputDir, { recursive: true });
  const artifactPath = path.join(outputDir, `phase-15-16-${mode}.json`);
  await writeFile(artifactPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return artifactPath;
}

async function runMode(mode, state, outputDir, execute) {
  const startedAt = new Date().toISOString();
  const steps =
    mode === "rehearsal"
      ? buildPhase15Steps().map((step) => describeStep(step, state))
      : mode === "rollback"
        ? buildPhase16RollbackSteps().map((step) => describeStep(step, state))
        : buildPhase16Steps().map((step) => describeStep(step, state));

  printPlan(mode, steps, execute);

  const executedSteps = [];
  for (const step of steps) {
    executedSteps.push(await runStep(step, state, execute));
  }

  const finishedAt = new Date().toISOString();
  const artifactPath = await writeArtifact(outputDir, mode, {
    mode,
    execute,
    startedAt,
    finishedAt,
    steps: executedSteps,
  });

  process.stdout.write(`${artifactPath}\n`);
  return executedSteps;
}

async function runPreflight(state, outputDir) {
  const issues = validatePrerequisites(state);
  const startedAt = new Date().toISOString();
  const finishedAt = new Date().toISOString();
  const artifactPath = await writeArtifact(outputDir, "preflight", {
    mode: "preflight",
    startedAt,
    finishedAt,
    issues,
  });

  if (issues.length > 0) {
    process.stderr.write("phase-16-runbook: preflight falhou\n");
    for (const issue of issues) {
      process.stderr.write(`- ${issue}\n`);
    }
    process.stderr.write(`${artifactPath}\n`);
    return 1;
  }

  process.stdout.write("phase-16-runbook: preflight ok\n");
  process.stdout.write(`${artifactPath}\n`);
  return 0;
}

export async function main(argv = process.argv.slice(2)) {
  const { mode, statePath, outputDir, execute } = parseArgs(argv);
  const loadedState = statePath ? await readJsonFile(path.resolve(statePath)) : {};
  const state = isPlainObject(loadedState) ? loadedState : {};

  if (mode === "preflight") {
    return await runPreflight(state, outputDir);
  }
  if (mode === "rehearsal" || mode === "cutover" || mode === "rollback") {
    await runMode(mode, state, outputDir, execute);
    return 0;
  }

  throw new Error(
    `Modo invalido: ${mode}. Use preflight, rehearsal, cutover ou rollback.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then((code) => {
      if (typeof code === "number" && code !== 0) {
        process.exit(code);
      }
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

