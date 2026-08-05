# Fase 1.17 — RAG, fake Ollama, cache e fallback

Data fixa: `2026-07-21T15:00:00.000Z`.

## Resultado

- Embeddings capturados com dimensão 768 e amostra fixa do fake Ollama.
- Ranking RAG congelado com pgvector, pg_trgm, pesos híbridos e rerank observado.
- Discrepância legada congelada: SQL encontra problemas/soluções, mas o serviço observado retorna vazio para essas fontes; manual/ajuda entram no prompt.
- Cache legado confirmado como isolado por usuário.
- Cache legado sem assinatura versionada confirmado como comportamento observado; o Python deverá exigir assinatura conforme Fase 11.
- Fallback do assistente congelado quando `/api/chat` do fake Ollama falha seletivamente.

## Artefatos

- Golden: `tests/fixtures/legacy-golden/phase1_17.ai_rag_cache.outputs.json`
- Evidência bruta: `docs\migration\evidence\phase-01\17-ai-rag-cache\ai-rag-cache.raw.json`
- Captura externa normalizada: `docs\migration\evidence\phase-01\17-ai-rag-cache\external-capture.normalized.json`
- Ranking SQL: `docs\migration\evidence\phase-01\17-ai-rag-cache\sql-rag-rankings.json`

## Observações vinculantes

- O Node usa threshold de cache `0.9` e TTL de 6h.
- O RAG usa threshold `0.35`, limite 5, multiplier 3, pesos híbridos 0.6/0.4 e rerank vetorial/keyword 0.5/0.3.
- O peso de recência é declarado no código, mas não participa do cálculo efetivo do rerank legado.
- O mapper legado de problemas/soluções aparentemente espera aliases camelCase, mas a query usa aliases snake_case; não corrigir nesta fase.
- Cache legado sem `graphVersion`, `promptVersion`, `toolCatalogVersion`, `metricVersion`, `chatModel`, `embeddingModel` e `cacheSignature` ainda é servido. Isso é defeito/limitação congelada para orientar o destino, não requisito a preservar.

## Checks principais

- Problemas RAG retornados pelo serviço: 
- Soluções RAG retornadas pelo serviço: 
- Cache parcial via API: cache
- Cache admin via API: ollama
- Fallback API generation: generation ausente
