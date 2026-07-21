# Congelamento temporario de API e worker

Fase: `0.12`
Data: `2026-07-21`
Status: ativo ate o fim da janela de rollback da migracao Python/FastAPI.

## Escopo congelado

Este congelamento se aplica a:

- `apps/api`
- `apps/worker`
- regras server-only em `packages/engine`
- schema, migrations, seeds e queries em `packages/db`
- contratos HTTP, WebSocket, SSE, Kafka, uploads, PDFs, auth e assistente de IA

`apps/web` continua podendo receber ajustes compativeis necessarios para rollback,
testes ou seguranca, desde que nao exija novo contrato backend sem registro.

## Regra de entrada para qualquer nova feature

Nenhuma feature nova de API ou worker pode entrar enquanto nao tiver:

1. contrato Node atual descrito em `docs/migration/contract-matrix.yaml` quando a matriz existir;
2. golden ou teste de caracterizacao Node equivalente;
3. tarefa explicita na fase/slice correspondente do `PLAN.md` ou em adendo aprovado;
4. plano de paridade Python;
5. decisao de rollback durante a janela de coexistencia.

Sem esses itens, a mudanca deve aguardar o fim da migracao ou ser tratada como
correcao emergencial aprovada.

## Excecoes permitidas

Excecoes aceitas nesta Fase 0:

- correcoes determinadas pelo `PLAN.md` para cache cross-user, SSE terminal,
  reasoning, PDF invalido, Mermaid, validacao de midia, shutdown e DLQ;
- correcoes necessarias para fazer os comandos de gate rodarem de forma
  reproduzivel, como dependencia de teste ausente;
- ajustes de teste que caracterizem comportamento existente sem ampliar contrato.

## Registro obrigatorio

Toda excecao deve registrar:

- arquivo alterado;
- motivo;
- evidencia ou teste;
- impacto em Node;
- tarefa equivalente para Python quando aplicavel.

O registro pode ficar no diario da migracao, no PR da fase ou na matriz da Fase 1.
