# Fase 3.5 — Procedimento futuro de backup e fingerprint real

Data: 2026-07-22

## Objetivo

Criar o procedimento obrigatório para quando staging/produção ou uma cópia sanitizada real estiverem disponíveis. Este procedimento é requisito para Subgate 3B, Fase 15, Fase 16, `stamp` real e qualquer troca de tráfego.

Esta etapa cria somente o procedimento. Nenhum backup real foi executado, nenhum banco externo foi consultado e nenhum arquivo de dump foi criado.

## Condições para executar este procedimento no futuro

Antes de executar contra staging/produção real, o executor deve ter:

- URL de conexão somente leitura ou credenciais de backup autorizadas;
- janela aprovada para backup lógico;
- destino de storage protegido fora do Git;
- chave/controle de acesso ao storage;
- nome do ambiente: `staging`, `production` ou `sanitized-copy`;
- identificador de execução: `<YYYYMMDD-HHMMSS>-<environment>`;
- confirmação explícita de que nenhum DDL, seed ou `stamp` será executado nesta fase.

Se qualquer item acima estiver ausente, parar e registrar bloqueio do Subgate 3B. A ausência desses itens não bloqueia fases locais 3.6–14.

## Variáveis locais obrigatórias

Definir em shell local seguro, sem commitar valores:

```powershell
$env:MIGRATION_ENV = "staging" # ou production/sanitized-copy
$env:MIGRATION_RUN_ID = "YYYYMMDD-HHMMSS-$env:MIGRATION_ENV"
$env:DATABASE_URL_REAL = "<postgres-url-real>"
$env:BACKUP_DIR = "<diretorio-local-temporario-fora-do-git>"
$env:PROTECTED_STORAGE_URI = "<storage-protegido-fora-do-git>"
```

Regras:

- `BACKUP_DIR` não pode estar dentro do repositório;
- não imprimir `DATABASE_URL_REAL`;
- não salvar `.env` com segredo em Git;
- não anexar dump completo a issue, PR, chat ou evidência versionada;
- evidência versionada pode conter apenas schema-only sanitizado, hashes, contagens e logs sem DSN.

## Passo 1 — Preparar diretório local fora do Git

```powershell
New-Item -ItemType Directory -Force -Path $env:BACKUP_DIR
```

Condição de parada:

- se `$env:BACKUP_DIR` resolver para dentro do repositório, parar;
- se o diretório não puder ser protegido por permissões locais adequadas, parar.

## Passo 2 — Backup lógico completo em formato custom

```powershell
pg_dump `
  --format=custom `
  --no-owner `
  --no-privileges `
  --file "$env:BACKUP_DIR/$env:MIGRATION_RUN_ID.full.dump" `
  "$env:DATABASE_URL_REAL"
```

Critérios:

- exit code deve ser `0`;
- dump completo fica fora do Git;
- dump completo deve ser enviado para storage protegido;
- dump completo nunca é usado como evidência versionada.

Condição de parada:

- qualquer erro de `pg_dump` bloqueia Subgate 3B;
- não continuar com dump parcial.

## Passo 3 — Schema-only sanitizado para evidência

```powershell
pg_dump `
  --schema-only `
  --no-owner `
  --no-privileges `
  --file "$env:BACKUP_DIR/$env:MIGRATION_RUN_ID.schema-only.sql" `
  "$env:DATABASE_URL_REAL"
```

Antes de versionar qualquer trecho:

- verificar ausência de DSN, senha, token, host privado sensível e comentários operacionais;
- preferir registrar hash do arquivo e trechos mínimos necessários;
- se houver dúvida de sensibilidade, não versionar o SQL.

## Passo 4 — Lista de restore

```powershell
pg_restore --list "$env:BACKUP_DIR/$env:MIGRATION_RUN_ID.full.dump" `
  > "$env:BACKUP_DIR/$env:MIGRATION_RUN_ID.pg_restore.list.txt"
```

Critérios:

- `pg_restore --list` deve sair com `0`;
- a lista deve conter tabelas, constraints, índices e extensões esperadas;
- a lista sanitizada pode ser versionada se não contiver dado sensível.

## Passo 5 — Upload para storage protegido

Enviar para `$env:PROTECTED_STORAGE_URI`:

- `$env:MIGRATION_RUN_ID.full.dump`;
- `$env:MIGRATION_RUN_ID.schema-only.sql`;
- `$env:MIGRATION_RUN_ID.pg_restore.list.txt`;
- checksums locais.

Exemplo de checksum local:

```powershell
Get-FileHash "$env:BACKUP_DIR/$env:MIGRATION_RUN_ID.full.dump" -Algorithm SHA256
Get-FileHash "$env:BACKUP_DIR/$env:MIGRATION_RUN_ID.schema-only.sql" -Algorithm SHA256
Get-FileHash "$env:BACKUP_DIR/$env:MIGRATION_RUN_ID.pg_restore.list.txt" -Algorithm SHA256
```

Condição de parada:

- se upload ou checksum não puderem ser verificados, bloquear Subgate 3B.

## Passo 6 — Restore descartável

Criar banco descartável sem tráfego e restaurar o dump:

```powershell
createdb "<restore-db-name>"

pg_restore `
  --dbname "<restore-db-url>" `
  --no-owner `
  --no-privileges `
  --exit-on-error `
  "$env:BACKUP_DIR/$env:MIGRATION_RUN_ID.full.dump"
```

Regras:

- nunca restaurar por cima de staging/produção ativos;
- restore deve ser descartável;
- se `pg_restore` falhar, parar;
- não executar seed após restore.

## Passo 7 — Captura read-only no restore

Executar o capturador da Fase 3.4 contra o banco restaurado:

```powershell
npm run py:capture-schema -- `
  --database-url "<restore-db-url>" `
  --pretty `
  --output "$env:BACKUP_DIR/$env:MIGRATION_RUN_ID.restore.schema-capture.json"
```

Critérios:

- JSON deve conter `readOnly: true`;
- `sanitizedTableChecksums[*].includesRowData` deve ser `false`;
- payload não deve conter DSN;
- fingerprint deve ter 64 caracteres hex.

## Passo 8 — Captura read-only no banco real

Executar o capturador da Fase 3.4 contra o banco real, preferencialmente com credencial somente leitura:

```powershell
npm run py:capture-schema -- `
  --database-url "$env:DATABASE_URL_REAL" `
  --pretty `
  --output "$env:BACKUP_DIR/$env:MIGRATION_RUN_ID.real.schema-capture.json"
```

Critérios:

- JSON deve conter `readOnly: true`;
- payload não deve conter DSN;
- não deve haver erro de permissão em catálogos necessários;
- se a credencial real não puder consultar grants/triggers/views, registrar limitação e bloquear Subgate 3B até owner aprovar exceção ou credencial adequada.

## Passo 9 — Comparação restore vs real

Comparar:

- fingerprints;
- extensões;
- tabelas;
- colunas;
- constraints;
- FKs;
- índices;
- triggers;
- views;
- grants/owners quando disponíveis;
- row counts aproximados;
- checksums sanitizados por tabela.

Critério principal:

- restore e real devem produzir fingerprints equivalentes ou divergências explicitamente explicadas por owner/grants/estatísticas voláteis previamente documentadas.

Condição de parada:

- divergência estrutural não explicada bloqueia Subgate 3B.

## Passo 10 — Comparação real/restore vs baseline local

Comparar a captura real/restaurada com as decisões da Fase 3.3:

- 40 tabelas esperadas;
- 323 colunas esperadas antes da tabela aditiva `ai_assistant_artifact`;
- `group_permissions` sem `resource_v2/action_v2`, salvo decisão explícita de reconciliação;
- extensões esperadas para baseline Python: `vector`, `pg_trgm`, `pgcrypto`;
- índices RAG esperados de `0007`/`0008`;
- `gen_random_uuid()` disponível;
- `Vector(768)` preservado;
- status/semântica conforme `docs/migration/ai/model-run-status-semantics.yaml`.

Condição de parada:

- produção real vence fonte versionada em caso de drift não resolvido;
- não modelar/stampar assumindo que produção é igual ao local sem evidência.

## Passo 11 — Evidência versionável permitida

Pode ser versionado:

- resumo do ambiente sem DSN;
- hashes SHA-256 dos arquivos;
- `pg_restore --list` sanitizado;
- fingerprint do capturador;
- contagens por seção;
- lista de divergências;
- decisão de owner para cada divergência.

Não pode ser versionado:

- dump completo;
- dados de linhas;
- DSN;
- senha/token;
- arquivo `.env`;
- logs com segredo;
- conteúdo sensível de grants/owners se o owner classificar como sensível.

## Critério de conclusão futura do Subgate 3B

O Subgate 3B só pode ser considerado aprovado quando:

1. backup completo real existe em storage protegido e checksum foi validado;
2. `pg_restore --list` foi gerado e revisado;
3. restore descartável foi concluído com `--exit-on-error`;
4. capturas read-only do real e do restore foram geradas;
5. fingerprints real/restore foram comparados;
6. divergências foram resolvidas ou formalmente aceitas;
7. nenhuma ação DDL/seed/`stamp` foi executada fora do fluxo autorizado.

## Resultado

Procedimento criado. A execução real permanece pendente até haver acesso a staging/produção ou cópia sanitizada. Essa pendência bloqueia Subgate 3B, Fase 15, Fase 16, `stamp` real e cutover, mas não bloqueia as fases locais 3.6–14.
