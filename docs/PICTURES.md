# Paginas e Figuras via API

Guia tecnico para substituir o JSON fake de paginas e figuras por API, mantendo o mesmo contrato de dados usado hoje em `src/app/admin/monitoring/pictures.json`.

---

## Objetivo

Migrar a secao `Paginas e Figuras da Previsao do tempo` de uma fonte estatica (arquivo JSON local) para uma fonte dinamica via API, com:

- listagem de paginas monitoradas
- lista de links/figuras por pagina
- status consolidado por pagina e por link
- resposta compativel com a UI atual da pagina de Monitoramento
- evolucao segura para ambiente real (observabilidade, cache e permissoes)

---

## Formato de Dados (Contrato Canonico)

A resposta deve seguir o formato abaixo:

```json
{
  "pages": [
    {
      "id": "monitoramento-novo-monitoramento-dsa",
      "name": "Monitoramento - Novo Monitoramento DSA",
      "url": "http://pomerode.cptec.inpe.br/monitora_cptec/",
      "description": "Conferencia direta da pagina.",
      "checkMode": "page",
      "status": "undefined",
      "delay": "indefinido",
      "delayMinutes": null,
      "delayedLinks": 0,
      "offlineLinks": 0,
      "onlineLinks": 0,
      "links": [
        {
          "id": "monitoramento-novo-monitoramento-dsa-pagina",
          "name": "pagina",
          "url": "http://pomerode.cptec.inpe.br/monitora_cptec/",
          "size": "0 Kb",
          "lastUpdate": "06/03 20:26",
          "delay": "indefinido",
          "delayMinutes": null,
          "status": "undefined",
          "type": "page"
        }
      ]
    }
  ]
}
```

Regras essenciais:

- `pages[]`: lista de paginas monitoradas da previsao do tempo
- `page.id`: identificador tecnico estavel
- `page.name`: nome exibido na UI
- `page.url`: URL principal da pagina monitorada
- `page.description`: descricao exibida ao expandir o item
- `page.checkMode`: modo de verificacao (`page` ou `items`)
- `page.status`: status consolidado da pagina (dominio abaixo)
- `page.delay`: atraso consolidado ja formatado para exibicao
- `page.delayMinutes`: atraso numerico consolidado (`null` quando nao aplicavel)
- `page.delayedLinks`: quantidade de links atrasados
- `page.offlineLinks`: quantidade de links offline
- `page.onlineLinks`: quantidade de links online (opcional, porem recomendado)
- `page.links[]`: lista de links/figuras associados a pagina
- `link.id`: identificador tecnico estavel do item
- `link.name`: nome amigavel do item
- `link.url`: URL final da figura/arquivo/pagina
- `link.size`: tamanho formatado para exibicao (ex.: `388 Kb`)
- `link.lastUpdate`: data/hora formatada para exibicao (ex.: `06/03 20:26`)
- `link.delay`: atraso textual para UI (ex.: `atrasado`, `offline`, `indefinido`)
- `link.delayMinutes`: atraso numerico (`null` quando nao aplicavel)
- `link.status`: status do item (dominio abaixo)
- `link.type`: tipo do item monitorado (ex.: `page`, `asset`)

Status permitidos (`page.status` e `link.status`):

- `ok`: item disponivel e dentro da janela esperada
- `delayed`: item disponivel, porem atrasado
- `offline`: item indisponivel
- `undefined`: sem informacao confiavel para classificar

Modos permitidos (`page.checkMode`):

- `page`: monitora somente a URL principal da pagina
- `items`: monitora lista de links/figuras vinculados a pagina

---

## Endpoints Recomendados

### 1) Listar paginas e figuras para a tela

```http
GET /api/admin/monitoring/pictures
```

Resposta sugerida:

```json
{
  "success": true,
  "data": {
    "pages": []
  }
}
```

Uso no frontend:

- preencher a secao `Paginas e Figuras da Previsao do tempo` da pagina `/admin/monitoring`
- montar os cards/accordion com ordenacao por criticidade
- alimentar os indicadores de `Links ok`, `Links atrasados` e `Links offline`

### 2) Obter uma pagina especifica (detalhe)

```http
GET /api/admin/monitoring/pictures/{pageId}
```

Resposta sugerida:

```json
{
  "success": true,
  "data": {
    "id": "monitoramento-novo-monitoramento-dsa",
    "name": "Monitoramento - Novo Monitoramento DSA",
    "url": "http://pomerode.cptec.inpe.br/monitora_cptec/",
    "description": "Conferencia direta da pagina.",
    "checkMode": "page",
    "status": "undefined",
    "delay": "indefinido",
    "delayMinutes": null,
    "delayedLinks": 0,
    "offlineLinks": 0,
    "onlineLinks": 0,
    "links": []
  }
}
```

Observacao:

- atualmente a UI ja pode receber tudo pelo endpoint de lista
- o endpoint de detalhe e opcional para evolucao futura

---

## Como Implementar no Frontend

Estado atual:

- fonte local: `src/app/admin/monitoring/pictures.json`
- consumo da secao: `src/app/admin/monitoring/page.tsx`
- renderizacao da lista: `src/components/admin/monitoring/PicturePagesAccordion.tsx`

Migracao para API (passo a passo):

1. Criar rota `GET /api/admin/monitoring/pictures`.
2. Manter o mesmo contrato `PicturePage[]` ja usado no frontend.
3. Substituir `import picturesJson from "./pictures.json"` por `fetch` com `cache: "no-store"`.
4. Tratar loading e fallback para lista vazia.
5. Preservar os status e contadores (`delayedLinks`, `offlineLinks`, `onlineLinks`) para manter a ordenacao atual do accordion.

Exemplo de consumo:

```ts
const res = await fetch("/api/admin/monitoring/pictures", {
  cache: "no-store",
});

if (!res.ok) {
  setPicturePages([]);
  return;
}

const json = (await res.json()) as ApiResponse<{ pages: PicturePage[] }>;
setPicturePages(json.success ? (json.data?.pages ?? []) : []);
```

---

## Regras de Consolidacao de Status

Recomendacao para backend ao montar `page.status`:

- `offline` quando existir ao menos 1 link offline em `links[]`
- `delayed` quando nao houver offline, mas existir link atrasado
- `ok` quando todos os links estiverem ok
- `undefined` quando nao for possivel classificar com confianca

Recomendacao para `page.delay`:

- em `checkMode: page`, usar atraso textual da propria URL principal
- em `checkMode: items`, usar sintese por contagem (ex.: `8 links atrasados`, `2 links offline`)

Importante:

- o frontend nao deve recalcular status principal
- a API deve retornar `status`, `delay` e contadores consolidados prontos

---

## Validacoes de Consistencia

A API deve validar antes de responder:

- `page.id` unico no payload
- `link.id` unico dentro de cada pagina
- `checkMode` dentro do dominio permitido (`page`, `items`)
- `status` dentro do dominio permitido (`ok`, `delayed`, `offline`, `undefined`)
- `url` de pagina e link em formato valido
- `delayedLinks`, `offlineLinks` e `onlineLinks` coerentes com `links[]`
- `delayMinutes >= 0` quando informado

Validacoes recomendadas para qualidade operacional:

- detectar pagina `items` sem `links[]`
- detectar links duplicados por URL
- registrar inconsistencias de origem (crawler/validador de links)

---

## Cache e Performance

Para leituras frequentes na tela de monitoramento:

- `Cache-Control: private, max-age=15`
- ETag no payload de paginas/figuras
- invalidar cache quando novo ciclo de verificacao terminar

Se a origem de monitoramento for pesada:

- adicionar camada de agregacao no backend
- evitar verificacao de disponibilidade no frontend
- evitar fan-out de requests por item durante renderizacao

---

## Seguranca e Permissoes

- endpoint restrito a usuario autenticado
- validar permissao de visualizacao de dashboard/monitoramento
- proteger URLs sensiveis quando necessario (mascarar ou assinar)
- registrar auditoria de falhas de integracao e timeout em origens externas

---

## Erros (padrao recomendado)

```json
{ "success": false, "error": "Falha ao obter dados de paginas e figuras." }
```

Cenarios esperados:

- `400`: parametro invalido (quando houver filtros)
- `403`: sem permissao
- `404`: pagina nao encontrada (endpoint de detalhe)
- `500`: falha inesperada no backend ou no verificador de links

---

## Plano de Migracao (Fake -> API)

1. Criar endpoint `pictures` com contrato canonico.
2. Publicar no frontend com `fetch` mantendo os mesmos campos e tipos.
3. Manter fallback opcional para `pictures.json` apenas em desenvolvimento.
4. Ativar monitoramento e alertas para volume de links offline/atrasados.
5. Remover dependencia de `pictures.json` em producao.

---

## Compatibilidade com o Frontend Atual

A UI atual da secao de monitoramento de paginas e figuras ja esta preparada para o contrato acima. A migracao para API exige apenas:

- trocar fonte de dados local por chamada HTTP
- preservar nomes e tipos dos campos
- manter status e contadores consolidados

Com isso, o comportamento visual dos indicadores e do accordion permanece estavel.

---

## Referencias Internas

- JSON fake atual: `src/app/admin/monitoring/pictures.json`
- Tela de consumo: `src/app/admin/monitoring/page.tsx`
- Componente de renderizacao: `src/components/admin/monitoring/PicturePagesAccordion.tsx`
- API geral do projeto: `docs/API.md`
- Padrao de documentacao semelhante: `docs/RADARS.md`
