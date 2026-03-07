# Radares via API

Guia técnico para substituir o JSON fake de monitoramento de radares por API, mantendo o mesmo contrato de dados usado hoje em `src/app/admin/monitoring/radars.json`.

---

## Objetivo

Migrar o módulo de Radares de uma fonte estática (arquivo JSON local) para uma fonte dinâmica via API, com:

- listagem por grupos de radares
- status e atraso já calculados no backend
- resposta compatível com a UI atual da página de Monitoramento
- evolução segura para ambiente real (observabilidade, cache e permissões)

---

## Formato de Dados (Contrato Canônico)

A resposta deve seguir o formato abaixo:

```json
{
  "groups": [
    {
      "id": "cemaden",
      "name": "CEMADEN",
      "radars": [
        {
          "id": "almenara",
          "name": "almenara",
          "description": "Radar de monitoramento hidrometeorologico.",
          "logDate": "2026-03-06T08:12:00-03:00",
          "logUrl": "https://logs.example.com/radars/cemaden/almenara",
          "delay": "0 min",
          "delayMinutes": 0,
          "status": "ok"
        }
      ]
    }
  ]
}
```

Regras essenciais:

- `groups[]`: lista de grupos provedores de radar (ex.: `CEMADEN`, `DECEA`)
- `group.id`: identificador tecnico estavel
- `group.name`: nome exibido na UI
- `radars[]`: lista de radares do grupo
- `radar.id`: identificador tecnico estavel
- `radar.name`: nome exibido e usado para inicial no bloco
- `radar.description`: texto exibido no dialog
- `radar.logDate`: timestamp ISO da ultima atualizacao de log
- `radar.logUrl`: URL do log do radar
- `radar.delay`: atraso ja formatado para exibicao (ex.: `"37 min"`, `"indefinido"`)
- `radar.delayMinutes`: atraso numerico para ordenacoes/filtros (`null` quando nao aplicavel)
- `radar.status`: um dos valores permitidos abaixo

Status permitidos:

- `ok`: sem atraso (bloco verde)
- `delayed`: com atraso (bloco vermelho)
- `undefined`: status indefinido (bloco cinza)
- `off`: radar desativado (bloco branco)

---

## Endpoints Recomendados

### 1) Listar grupos e radares para a tela

```http
GET /api/admin/monitoring/radars
```

Resposta sugerida:

```json
{
  "success": true,
  "data": {
    "groups": []
  }
}
```

Uso no frontend:

- preencher a coluna `Radares` da página `/admin/monitoring`
- renderizar grupos e blocos de radar
- abrir dialog ao clicar em um radar

### 2) Obter um radar especifico (detalhe)

```http
GET /api/admin/monitoring/radars/{radarId}
```

Resposta sugerida:

```json
{
  "success": true,
  "data": {
    "id": "almenara",
    "name": "almenara",
    "description": "Radar de monitoramento hidrometeorologico.",
    "logDate": "2026-03-06T08:12:00-03:00",
    "logUrl": "https://logs.example.com/radars/cemaden/almenara",
    "delay": "0 min",
    "delayMinutes": 0,
    "status": "ok"
  }
}
```

Observacao:

- atualmente a UI ja recebe todos os detalhes no endpoint de lista
- o endpoint de detalhe e opcional para evolucao futura

---

## Como Implementar no Frontend

Estado atual:

- fonte local: `src/app/admin/monitoring/radars.json`
- consumo na tela: `src/app/admin/monitoring/page.tsx`

Migracao para API (passo a passo):

1. Criar rota `GET /api/admin/monitoring/radars`.
2. Manter o mesmo contrato `RadarFile` ja usado no frontend.
3. Substituir `import radarsJson from "./radars.json"` por `fetch` com `cache: "no-store"`.
4. Tratar loading e fallback para lista vazia.
5. Manter mapeamento de cores/status atual na UI (`ok`, `delayed`, `undefined`, `off`).

Exemplo de consumo:

```ts
const res = await fetch(config.getApiUrl("/api/admin/monitoring/radars"), {
  cache: "no-store",
});

if (!res.ok) {
  setRadarGroups([]);
  return;
}

const json = (await res.json()) as ApiResponse<{ groups: RadarGroup[] }>;
setRadarGroups(json.success ? (json.data?.groups ?? []) : []);
```

---

## Regra de Calculo de Atraso

Recomendacao para backend:

- definir janela esperada de publicacao por radar (SLA)
- calcular `delayMinutes` como diferenca entre `agora` e `logDate` menos o SLA
- normalizar para:
  - `ok` quando atraso efetivo <= limite
  - `delayed` quando atraso efetivo > limite
  - `undefined` quando sem informacao confiavel de log
  - `off` quando radar estiver desativado

Importante:

- a string `delay` deve vir pronta para exibicao
- `delayMinutes` deve manter valor bruto para filtros e ordenacao

---

## Validacoes de Consistencia

A API deve validar antes de responder:

- `group.id` e `radar.id` unicos no payload
- `status` dentro do dominio permitido
- `logDate` em formato ISO valido quando aplicavel
- `logUrl` com URL valida
- `delayMinutes >= 0` quando informado

Validacoes recomendadas para qualidade operacional:

- detectar radares sem grupo
- detectar grupo sem radares
- registrar inconsistencias de origem de log

---

## Cache e Performance

Para leituras frequentes na tela de monitoramento:

- `Cache-Control: private, max-age=15`
- ETag no payload de radares
- invalidar cache quando novo lote de logs chegar

Se a origem de logs for pesada:

- adicionar camada de agregacao/normalizacao no backend
- evitar calculo de atraso no frontend

---

## Seguranca e Permissoes

- endpoint restrito a usuario autenticado
- validar permissao de visualizacao de dashboard
- ocultar/mascarar `logUrl` sensivel quando necessario
- registrar auditoria de falhas de integracao com origem de logs

---

## Erros (padrao recomendado)

```json
{ "success": false, "error": "Falha ao obter dados de radares." }
```

Cenarios esperados:

- `400`: parametro invalido (quando houver filtros)
- `403`: sem permissao
- `404`: radar nao encontrado (endpoint de detalhe)
- `500`: falha inesperada no backend ou no coletor de logs

---

## Plano de Migracao (Fake -> API)

1. Criar endpoint `radars` com o contrato canônico.
2. Publicar no frontend com `fetch` mantendo o mesmo modelo de dados.
3. Manter fallback opcional para JSON local apenas em desenvolvimento.
4. Ativar monitoramento e alertas para atraso acima de limiar.
5. Remover dependencia de `radars.json` em producao.

---

## Compatibilidade com o Frontend Atual

A UI atual da página de Monitoramento ja esta preparada para o contrato acima. A migracao para API exige apenas:

- trocar a fonte de dados local por chamada HTTP
- preservar nomes e tipos dos campos
- manter o mapeamento de status para cores e badges

Com isso, o comportamento visual da coluna `Radares` permanece estavel.

---

## Referencias Internas

- JSON fake atual: `src/app/admin/monitoring/radars.json`
- Tela de consumo: `src/app/admin/monitoring/page.tsx`
- API geral do projeto: `docs/API.md`
- Padrao de documentacao semelhante: `docs/DATAFLOW.md`
