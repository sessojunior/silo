import { spawnSync } from "child_process";

/**
 * Executa um comando no shell do sistema operacional.
 * @param {string} command - O comando principal (ex: docker)
 * @param {string[]} args - Lista de argumentos
 */
function run(command, args) {
  const fullCommand = `${command} ${args.join(" ")}`;
  console.log(`\n👉 Executando: ${fullCommand}`);

  // shell: true permite rodar no cmd/powershell (Windows) e bash (Linux)
  const result = spawnSync(command, args, { stdio: "inherit", shell: true });

  if (result.status !== 0) {
    console.error(`❌ O comando falhou com código de saída ${result.status}`);
    process.exit(result.status || 1);
  }
}

console.log("🚀 Iniciando Deploy do Silo...");

// 1. Subir containers (App + Banco) com build
// Equivalente a: docker compose --profile db up -d --build
run("docker", ["compose", "--profile", "db", "up", "-d", "--build"]);

// 2. Mostrar status dos containers
// Equivalente a: docker compose ps
run("docker", ["compose", "ps"]);

console.log("\n✅ Deploy finalizado com sucesso!");
console.log("🌐 Acesse a aplicação no navegador (ex: http://localhost:3000)");

console.log("\n📜 Exibindo logs da inicialização (entrypoint)...");
console.log(
  "⚠️  Pressione Ctrl+C para sair dos logs (a aplicação continuará rodando).",
);

console.log(
  "\n------------------------------------------------------------------------",
);

// 3. Exibir logs do container app para acompanhar o entrypoint
// Equivalente a: docker compose logs -f silo
run("docker", ["compose", "logs", "-f", "silo"]);
