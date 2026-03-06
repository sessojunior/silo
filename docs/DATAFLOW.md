# Fluxo de Dados via API

Guia técnico para substituir os JSONs fake de fluxo de dados por API, mantendo o mesmo contrato de dados usado hoje nos exemplos em `src/app/admin/products/[slug]/data-flow/pipeline-snapshots`.

---

## Objetivo

Migrar o módulo de Fluxo de Dados de uma fonte estática (arquivos JSON) para uma fonte dinâmica via API, com:

- consulta por `model`, `date` e `turn`
- resposta com o mesmo formato dos arquivos de exemplo
- dados consistentes para renderização de Gantt
- evolução segura para ambientes reais (observabilidade, cache, controle de acesso)

---

## Formato de Dados (Contrato Canônico)

Cada snapshot de fluxo deve seguir este formato:

```json
{
  "model": "bsm",
  "date": "2026-03-06",
  "turn": "18",
  "status": "completed",
  "groups": [
    {
      "id": "ingestion",
      "name": "Ingestao de dados",
      "tasks": [
        {
          "id": "download_gfs_025",
          "name": "Download GFS 0.25",
          "start": "2026-03-06T18:08:00Z",
          "end": "2026-03-06T18:47:00Z",
          "progress": 100,
          "status": "completed",
          "dependencies": [],
          "type": "task"
        }
      ]
    }
  ]
}
```

Regras essenciais:

- `model`: slug do produto (ex.: `bsm`, `wrf`, `smec`)
- `date`: formato `YYYY-MM-DD`
- `turn`: string do turno (`"0"`, `"6"`, `"12"`, `"18"`, etc.)
- `status`: status agregado do snapshot
- `groups`: agrupamentos lógicos de execução
- `tasks`: itens exibidos no Gantt

Campos de task:

- `start` e `end` em ISO UTC
- `progress` entre `0` e `100`
- `dependencies` com IDs válidos de tasks existentes no mesmo snapshot
- `type`: `task` ou `product`

---

## Endpoints Recomendados

### 1) Listar opções para o seletor (datas/turnos)

```http
GET /api/admin/products/{slug}/data-flow/options?days=4
```

Resposta sugerida:

```json
{
  "success": true,
  "data": {
    "model": "bsm",
    "days": [
      {
        "date": "2026-03-06",
        "turns": [
          { "turn": "18", "status": "completed" },
          { "turn": "12", "status": "completed" },
          { "turn": "6", "status": "completed" },
          { "turn": "0", "status": "completed" }
        ]
      }
    ]
  }
}
```

Uso no frontend:

- montar o `Select` com ordenacao decrescente por data e turno
- evitar hardcode de turnos por produto

### 2) Obter snapshot por data e turno

```http
GET /api/admin/products/{slug}/data-flow?date=2026-03-06&turn=18
```

Resposta sugerida:

```json
{
  "success": true,
  "data": {
    "model": "bsm",
    "date": "2026-03-06",
    "turn": "18",
    "status": "completed",
    "groups": []
  }
}
```

### 3) Buscar snapshot mais recente (fallback)

```http
GET /api/admin/products/{slug}/data-flow/latest
```

Resposta sugerida:

```json
{
  "success": true,
  "data": {
    "model": "bsm",
    "date": "2026-03-06",
    "turn": "18",
    "status": "completed",
    "groups": []
  }
}
```

---

## Ordenacao (contrato funcional)

- datas: mais nova para mais antiga
- turnos: maior para menor (ex.: `18`, `12`, `6`, `0`)
- valor padrao ao abrir a pagina: primeiro item da ordenacao (data mais nova + ultimo turno)

---

## Validacoes de Consistencia

A API deve validar antes de responder:

- todos os `dependencies[]` existem no mesmo snapshot
- `end > start` para toda task
- `progress` no intervalo `0..100`
- `status` permitido
- `model` da resposta igual ao `slug` solicitado

Validacoes recomendadas para qualidade operacional:

- detectar ciclos em dependencias (A -> B -> A)
- detectar tarefas isoladas sem grupo
- detectar sobreposicoes criticas indevidas, quando regra de negocio exigir

---

## Modelo de Persistencia (sugestao)

Opcao A (mais simples para inicio):

- tabela unica `product_data_flow_snapshot`
- campos: `product_slug`, `date`, `turn`, `status`, `payload_json`, `created_at`, `updated_at`
- indice unico: `(product_slug, date, turn)`

Opcao B (normalizada para analytics):

- `product_data_flow_run` (snapshot)
- `product_data_flow_group` (grupos)
- `product_data_flow_task` (tasks)
- `product_data_flow_task_dependency` (relacao N:N)

Recomendacao pratica:

- comecar na Opcao A para entrega rapida
- evoluir para Opcao B quando houver demanda de relatorios analiticos por task

---

## Cache e Performance

Para leitura frequente (dashboard/tela aberta):

- `Cache-Control: private, max-age=30`
- ETag para respostas de snapshot
- invalidar cache quando novo snapshot for publicado

Para dados historicos pouco mutaveis:

- `max-age` maior (60-300s), conforme necessidade

---

## Seguranca e Permissoes

- endpoint restrito a usuario autenticado
- validar permissao de leitura de produto
- nunca expor dados de modelo diferente do `slug` requisitado
- registrar auditoria para erros de consistencia e acessos negados

---

## Erros (padrao recomendado)

```json
{ "success": false, "error": "Parâmetro date inválido." }
```

Cenarios esperados:

- `400`: query invalida (`date/turn`)
- `404`: snapshot inexistente
- `403`: sem permissao
- `500`: falha inesperada

---

## Plano de Migracao (Fake -> API)

1. Criar endpoint `options` e consumir no `Select`.
2. Criar endpoint `data-flow` por `date/turn` e substituir import JSON no frontend.
3. Manter fallback temporario para arquivo local apenas em desenvolvimento.
4. Ativar monitoramento e alertas de inconsistencias.
5. Remover dependencia de arquivos `pipeline-snapshots` em producao.

---

## Compatibilidade com o Frontend Atual

A UI atual (tabs + select + Gantt) ja funciona com o contrato acima. A migracao para API exige apenas:

- trocar a fonte de dados (`import ...json` -> `fetch`)
- preservar os mesmos campos e nomes
- manter a ordenacao funcional do seletor

Com isso, o comportamento visual permanece estavel e previsivel.

---

## Referencias Internas

- Exemplo de payloads fake: `src/app/admin/products/[slug]/data-flow/pipeline-snapshots`
- Tela de consumo: `src/app/admin/products/[slug]/data-flow/page.tsx`
- Seletor/tabs: `src/components/admin/nav/ProductTabs.tsx`
- API geral do projeto: `docs/API.md`
