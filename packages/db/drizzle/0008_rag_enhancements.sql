-- Migration: Melhorias RAG — chunks de manuais, embedding na ajuda, busca híbrida
-- Executar via: npx tsx packages/db/run-migration.ts
-- Ou manualmente: psql -U silo -d silo -f packages/db/drizzle/0008_rag_enhancements.sql

-- Extensão pgvector (garantia)
CREATE EXTENSION IF NOT EXISTS vector;

-- Extensão pg_trgm para busca híbrida (trigram similarity)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Tabela de chunks de manuais de produto (para RAG com chunking)
-- Cada parágrafo/seção do manual vira um chunk com embedding independente
CREATE TABLE IF NOT EXISTS product_manual_chunk (
    id TEXT PRIMARY KEY,
    product_manual_id TEXT NOT NULL REFERENCES product_manual(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER NOT NULL DEFAULT 0,
    embedding vector(768),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índice HNSW para busca semântica nos chunks
CREATE INDEX IF NOT EXISTS idx_product_manual_chunk_embedding
    ON product_manual_chunk USING hnsw (embedding vector_cosine_ops);

-- Índice para busca por produto
CREATE INDEX IF NOT EXISTS idx_product_manual_chunk_product_id
    ON product_manual_chunk(product_id);

-- Índice trigram para busca textual nos chunks (híbrida)
CREATE INDEX IF NOT EXISTS idx_product_manual_chunk_content_trgm
    ON product_manual_chunk USING gin (content gin_trgm_ops);

-- 2. Embedding na tabela de ajuda
ALTER TABLE help ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Índice HNSW para busca semântica na ajuda
CREATE INDEX IF NOT EXISTS idx_help_embedding
    ON help USING hnsw (embedding vector_cosine_ops);

-- 3. Índices trigram para busca híbrida em problemas e soluções
CREATE INDEX IF NOT EXISTS idx_product_problem_title_trgm
    ON product_problem USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_product_problem_description_trgm
    ON product_problem USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_product_solution_description_trgm
    ON product_solution USING gin (description gin_trgm_ops);
