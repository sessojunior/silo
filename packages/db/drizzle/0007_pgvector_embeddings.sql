-- Migration: pgvector + colunas de embedding para busca semântica
-- Executar manualmente: psql -U silo -d silo -f packages/db/drizzle/0007_pgvector_embeddings.sql
-- Ou via docker: docker compose exec db psql -U silo -d silo -f /docker-entrypoint-initdb.d/0007_pgvector_embeddings.sql

-- Extensão pgvector para busca por similaridade de cosseno
CREATE EXTENSION IF NOT EXISTS vector;

-- Embedding para cache semântico de respostas do assistente de IA
ALTER TABLE ai_assistant_message ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Embedding para RAG (Retrieval-Augmented Generation) em problemas
ALTER TABLE product_problem ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Embedding para RAG em soluções
ALTER TABLE product_solution ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Índices HNSW para busca eficiente por similaridade de cosseno
-- HNSW é melhor que IVFFlat para volumes baixos/médios: não requer rebuild periódico
CREATE INDEX IF NOT EXISTS idx_ai_message_embedding ON ai_assistant_message USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_product_problem_embedding ON product_problem USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_product_solution_embedding ON product_solution USING hnsw (embedding vector_cosine_ops);
