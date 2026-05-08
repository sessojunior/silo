# Plano de Programacao Orientada a Consumo do Silo

Objetivo: reduzir custo de contexto, duplicacao e indirecao para que o Silo fique mais rapido de entender, manter e evoluir com apoio de humanos e LLMs.

Status atual: Sprint 1 iniciada.

## Sprint 1 — Contrato HTTP unico

Meta: ter um unico envelope de resposta e um unico caminho de leitura no web.

- [ ] Tornar `packages/engine/src/contracts/api-response.ts` a fonte unica do envelope.
- [ ] Fazer o cliente HTTP do web ler respostas com o helper compartilhado, sem cast direto.
- [ ] Manter `apps/web/src/lib/api-response.ts` apenas como adaptador fino enquanto durar a migracao.
- [ ] Padronizar os campos permitidos no envelope: `success`, `ok`, `data`, `error`, `message`, `field` e `meta`.

Definicao de pronto:
- Nenhum novo cliente deve depender de `res.json() as ...`.
- O shape de resposta deve ser lido por helper central.

## Sprint 2 — Validacao na borda

Meta: validar entrada na borda e parar de espalhar schema inline ou validacao manual.

- [ ] Adotar `apps/api/src/middleware/validate.ts` como caminho padrao para request validation.
- [ ] Migrar schemas inline repetidos para `packages/engine/src/validation`.
- [ ] Substituir validacao manual por Zod onde ainda existir.
- [ ] Manter services recebendo entrada ja validada e tipada.

Definicao de pronto:
- Handlers recebem payloads validos ou retornam erro padronizado.

## Sprint 3 — Erros e retornos de service

Meta: remover `respond*ServiceError` duplicado e parar de depender de duck typing em resultados.

- [ ] Unificar o tratamento de erro de service em um helper comum.
- [ ] Trocar `if ("error" in result)` por unions discriminadas ou retorno tipado unico.
- [ ] Padronizar `status`, `field` e metadados de erro.
- [ ] Aplicar primeiro em `products`, `projects`, `users` e `contacts`.

Definicao de pronto:
- Cada camada sabe exatamente como ler sucesso e erro sem repetir logica.

## Sprint 4 — Modularizacao dos arquivos caros

Meta: quebrar os arquivos com mais contexto em unidades menores e previsiveis.

- [ ] Dividir `apps/api/src/routes/auth-custom.ts` por fluxo funcional.
- [ ] Extrair transformers e normalizadores de `apps/api/src/dataflow/kafka-data-flow-source.ts`.
- [ ] Separar responsabilidades de `apps/api/src/services/product-service.ts`.
- [ ] Simplificar `apps/worker/src/index.ts` em boot, roteamento e retry/DLQ.

Definicao de pronto:
- Nenhum arquivo critico concentra validacao, orquestracao e regra de negocio ao mesmo tempo.

## Sprint 5 — Entrada e barrels

Meta: deixar o ponto de entrada mais legivel e com menos surpresa.

- [ ] Corrigir montagens duplicadas em `apps/api/src/index.ts`.
- [ ] Reorganizar rotas por dominio para que o bootstrap fique linear.
- [ ] Reduzir barrels amplos em `packages/engine/src/contracts/index.ts` quando eles aumentarem ruido.

Definicao de pronto:
- O mapa do sistema pode ser lido sem abrir muitos arquivos auxiliares.

## Sprint 6 — Docs e guardrails

Meta: documentar o padrao simples para evitar que o codigo volte a crescer em complexidade.

- [ ] Atualizar `docs/02-architecture.md` e `docs/03-patterns.md`.
- [ ] Criar um playbook curto por dominio critico: auth, products e uploads.
- [ ] Registrar o padrao de escrita simples e linear para novas features.

Definicao de pronto:
- O time tem uma referencia curta e pratica para seguir nas proximas entregas.

## Ordem sugerida

1. Sprint 1 e Sprint 2 para reduzir contexto imediatamente.
2. Sprint 3 para padronizar erro e retorno.
3. Sprint 4 e Sprint 5 para cortar arquivos grandes e diminuir surpresa.
4. Sprint 6 para consolidar os guardrails.

## Primeiro passo executado

- O cliente HTTP do web passa a ler a resposta via helper compartilhado, reduzindo o acoplamento com cast direto.