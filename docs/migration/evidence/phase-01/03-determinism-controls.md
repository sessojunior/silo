# Fase 1.3 — controles determinísticos

Data: 2026-07-21  
Status: concluído como base executável para o runner da Fase 1.4.

## Artefatos criados

- `tests/contracts/legacy/determinism-preload.cjs`
- `tests/fixtures/legacy-golden/normalization.json`
- `tests/fixtures/legacy-golden/external-responses.json`

## Parâmetros congelados

- Timezone: `America/Sao_Paulo`
- Relógio: `2026-07-21T15:00:00.000Z` (`2026-07-21T12:00:00.000-03:00`)
- UUIDs: sequência determinística `10000000-0000-4000-8000-XXXXXXXXXXXX`
- `Math.random`: sequência finita repetível
- `crypto.randomBytes`, `crypto.randomInt`, `crypto.randomUUID` e WebCrypto best-effort: substituídos pelo preload de contrato
- Respostas externas: catálogo fake versionado para Ollama, SMTP e Kafka REST Proxy

## Uso previsto

O processo Node de contrato deve ser iniciado com:

```powershell
$env:SILO_CONTRACT_DETERMINISM = "1"
$env:NODE_ENV = "test"
$env:TZ = "America/Sao_Paulo"
$env:NODE_OPTIONS = "--require ./tests/contracts/legacy/determinism-preload.cjs"
```

O preload falha imediatamente se for carregado sem `SILO_CONTRACT_DETERMINISM=1` ou com `NODE_ENV=production`.

## Normalização permitida

`tests/fixtures/legacy-golden/normalization.json` documenta os JSONPaths voláteis que podem ser normalizados pelo comparador. Campos de contrato como `success`, `error`, `permissions`, `status`, `priority`, `sourceKind`, `provider` e `model` estão na lista de normalização proibida.

## Observações

O patch de WebCrypto é best-effort porque algumas versões do Node expõem propriedades read-only. Caso uma biblioteca gere token fora dos hooks substituídos, o token deve ser tratado apenas pelos JSONPaths/header normalizers já documentados; não é permitido ampliar normalização sem atualizar este arquivo e o catálogo.
