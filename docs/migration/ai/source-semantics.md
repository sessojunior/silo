# Semântica de fontes de problema do assistente

Data: 2026-07-22

Este documento congela a diferença entre rodada problemática e problema formal para as tools e respostas do assistente. A migração Python deve preservar essa separação e não pode somar, deduplicar ou vincular as fontes por inferência textual.

## Fontes canônicas

### `problematic_run`

Fonte física: `product_activity`.

Uma linha representa uma rodada/turno de um produto em uma data. Ela pode indicar incidente operacional por `status`, `problem_category_id`, `description` e `intervention`.

Chave canônica:

```text
product_activity.id
```

Regra de incidente:

- aplicar `docs/migration/ai/model-run-status-semantics.yaml`;
- contar como incidente somente quando `isIncident=true`;
- excluir sempre `problem_category_id="no_incidents"`;
- `pending` não é incidente;
- `off` não é incidente e é read-only legado;
- `in_progress` não é terminal e não é incidente.

Campos de citação mínimos:

- produto;
- data;
- turno;
- status;
- categoria, se existir e não for `no_incidents`;
- descrição/intervenção apenas quando a resposta precisar justificar a linha.

### `registered_problem`

Fonte física: `product_problem`.

Uma linha representa um problema formal cadastrado no sistema. Ela pode ter soluções em `product_solution` e checks em `product_solution_checked`.

Chave canônica:

```text
product_problem.id
```

Regra de problema real:

- excluir sempre `problem_category_id="no_incidents"`;
- contar soluções por `product_solution.id`;
- contar checks por `product_solution_checked.id`;
- um problema sem solução continua sendo um problema formal;
- múltiplas soluções pertencem ao mesmo problema e não criam múltiplos problemas.

Campos de citação mínimos:

- produto;
- título;
- categoria, se existir e não for `no_incidents`;
- data de criação/atualização;
- quantidade de soluções;
- quantidade de checks, quando perguntado sobre verificação/validação.

## Não há vínculo entre as fontes

O schema atual não possui FK entre `product_activity` e `product_problem`. As duas fontes compartilham apenas dimensões indiretas como produto, categoria e período.

Consequência vinculante:

- não inferir que uma rodada problemática corresponde a um problema formal;
- não deduplicar `product_activity` contra `product_problem` por produto, data, categoria, título, descrição, similaridade, RAG ou solução;
- não preencher artificialmente `product_problem_id` em uma rodada;
- não criar FK, tabela de vínculo ou matching heurístico nesta migração;
- se uma resposta precisar mostrar as duas fontes, devolver dois datasets ou duas seções com `sourceKind` explícito.

## Regras de agregação

### Agregação de `problematic_run`

- Contar `count(distinct product_activity.id)`.
- Agrupar por status usando a matriz da Fase 1.25.
- Agrupar por categoria apenas depois de excluir `no_incidents`.
- Disponibilidade usa os campos `isAvailable` e `countsForAvailabilityDenominator` da matriz da Fase 1.25.
- Intervenção não define incidente por si só; é evidência operacional da rodada.

### Agregação de `registered_problem`

- Contar `count(distinct product_problem.id)`.
- Agrupar por categoria apenas depois de excluir `no_incidents`.
- `solutionCount` é `count(distinct product_solution.id)`.
- `checkedSolutionCount` é `count(distinct product_solution_checked.id)`.
- Taxa de resolução só pode ser calculada por regra aprovada; o legado de 80% fixo não é semântica válida.

### Agregação combinada

Não usar um único campo `totalProblems` quando houver mistura das duas fontes.

Formato permitido:

```json
{
  "problematicRunCount": 6,
  "registeredProblemCount": 3,
  "sourceKinds": ["problematic_run", "registered_problem"]
}
```

Formato proibido:

```json
{
  "totalProblems": 9
}
```

## Categoria “sem incidente”

`no_incidents` é uma categoria técnica para afirmar ausência de incidente. Ela deve ser preservada em leitura, mas excluída de contagens de incidente e problema real.

Aplicação:

- `product_activity` com `problem_category_id="no_incidents"` não entra em ranking de causas/incidentes;
- `product_problem` com `problem_category_id="no_incidents"` não entra em ranking de problemas reais;
- a linha pode aparecer apenas em auditoria ou explicação de exclusão, com `sourceKind` e motivo.

## Exemplos de roteamento de perguntas

| Pergunta | Fonte | Regra |
|---|---|---|
| “Quais modelos tiveram incidentes ontem?” | `problematic_run` | Usar `product_activity`, status `isIncident=true`, excluir `no_incidents`. |
| “Quais rodadas não executaram no turno 6?” | `problematic_run` | Usar `product_activity.status=not_run`, citar produto/data/turno. |
| “Quais problemas cadastrados ainda não têm solução?” | `registered_problem` | Usar `product_problem` com `solutionCount=0`, excluir `no_incidents`. |
| “Quais soluções foram aplicadas para o problema X?” | `registered_problem` | Usar `product_solution` ligado ao `product_problem.id`. |
| “Compare incidentes de execução e problemas cadastrados da semana.” | ambas | Gerar dois datasets, sem somar em `totalProblems`. |
| “Categoria sem incidente aparece como falha?” | ambas | Responder que `no_incidents` é excluída e citar a regra. |

## Contrato para tools

Toda tool que exponha essas fontes deve incluir:

- `sourceKind`;
- IDs canônicos internos somente para rastreabilidade autorizada;
- label humano;
- contagens por fonte;
- `excludedNoIncidentsCount`, quando houver exclusão relevante;
- `statusSemanticsVersion`, apontando para a matriz da Fase 1.25;
- lista de citações que identifique se a origem é rodada ou problema formal.

Tools não recebem SQL livre, não aceitam nome arbitrário de tabela e não podem misturar as fontes sem campo explícito de composição.
