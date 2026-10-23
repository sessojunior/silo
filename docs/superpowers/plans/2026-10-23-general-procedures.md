# Procedimentos gerais e anexos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar uma base de procedimentos gerais com CRUD, anexos armazenados em disco, extração/indexação de documentos e consulta prioritária pela IA.

**Architecture:** O backend terá tabelas próprias para procedimentos, anexos e chunks extraídos; os binários ficarão no volume `/uploads/procedures/`. A API persistirá o procedimento e o anexo, processará o conteúdo de forma assíncrona e alimentará a busca RAG com o texto do procedimento, trechos de documentos e descrições/OCR de imagens. O frontend terá uma página própria no menu e exibirá o estado de processamento de cada anexo.

**Tech Stack:** FastAPI, SQLAlchemy Core, Alembic, PostgreSQL/pgvector, Python 3.13, `pypdf`, `python-docx`, `python-pptx`, Next.js/React/TypeScript, Vitest, pytest.

**Spec:** `docs/superpowers/specs/2026-10-23-general-procedures-design.md`

## Global Constraints

- Arquivos binários devem ser armazenados em `/uploads/procedures/`; o banco guarda somente metadados, referências e conteúdo derivado.
- Formatos iniciais com extração: PDF, TXT/MD, DOCX e PPTX; formatos sem extrator registrado devem ser rejeitados com erro explícito.
- Procedimentos inativos não entram na busca da IA.
- Para orientação geral, trechos de anexos relevantes têm prioridade sobre o texto do procedimento; o manual de produto continua preferencial em perguntas específicas do produto.
- A IA terá consulta somente leitura nesta entrega; operações de escrita continuam humanas e confirmadas.
- Usuários sem `procedures:view` não podem abrir a página nem consultar anexos pela API; `procedures:manage` controla escrita e reprocessamento.
- Todo conteúdo pesquisável deve guardar origem, procedimento, nome do anexo e página/slide quando disponíveis.

## Review Focus

- Extensão permitida com MIME real incompatível: rejeitar antes de criar registro ou arquivo órfão. Testar em Task 2.
- Nome de arquivo com traversal, symlink ou caminho absoluto: nunca sair do diretório de uploads. Testar em Task 2.
- Falha de extração ou formato sem extrator: marcar `error`, mostrar erro e excluir da busca. Testar em Tasks 2 e 4.
- Exclusão de procedimento/anexo: remover chunks, embeddings e arquivo físico sem deixar referência pesquisável. Testar em Tasks 3 e 4.
- Citação de documento: preservar nome e página/slide no resultado da IA e na resposta. Testar em Task 4.

---

### Task 1: Schema, permissões e contratos de procedimento

**Files:**
- Create: `apps/backend/migrations/versions/phase5_general_procedures.py`
- Modify: `apps/backend/src/silo/db/models.py`
- Modify: `apps/backend/src/silo/api/dependencies.py`
- Modify: `apps/backend/src/silo/api/routers/groups.py`
- Create: `packages/engine/src/contracts/dto/procedures.ts`
- Modify: `packages/engine/src/contracts/index.ts`
- Test: `apps/backend/tests/unit/test_general_procedure_schema.py`
- Test: `apps/backend/tests/unit/test_api_dependencies.py`

**Interfaces:**
- Produces the `general_procedure`, `general_procedure_attachment` and `general_procedure_attachment_chunk` table descriptors.
- Produces permissions `procedures:view` and `procedures:manage` through the existing canonical permission mechanism.
- Produces TypeScript DTOs for procedure, attachment, chunk location and processing status.

- [ ] **Step 1: Write failing schema and permission tests**

  Assert the migration creates the three tables, the attachment status values are represented, embedding metadata exists on searchable tables, and `procedures:manage` implies `procedures:view` while unrelated resources do not.

- [ ] **Step 2: Run tests to verify they fail**

  Run: `pytest apps/backend/tests/unit/test_general_procedure_schema.py apps/backend/tests/unit/test_api_dependencies.py -v`

  Expected: FAIL because the migration, table descriptors and permission resource do not exist.

- [ ] **Step 3: Implement schema and contracts**

  Add UUID/text identifiers consistent with the legacy tables, timestamps, active state, attachment metadata, extraction state, page/slide fields and 768-dimensional embedding metadata. Add a migration with a safe downgrade. Add `procedures:view` to the same default read experience as the existing knowledge/product viewers, while leaving manage permission restricted to administrators or explicitly managed groups.

- [ ] **Step 4: Run tests to verify they pass**

  Run: `pytest apps/backend/tests/unit/test_general_procedure_schema.py apps/backend/tests/unit/test_api_dependencies.py -v`

  Expected: PASS.

- [ ] **Step 5: Commit**

  Run: `git add apps/backend/migrations/versions/phase5_general_procedures.py apps/backend/src/silo/db/models.py apps/backend/src/silo/api/dependencies.py apps/backend/src/silo/api/routers/groups.py packages/engine/src/contracts && git commit -m "feat: add general procedure schema and permissions"`

### Task 2: Upload seguro e extração de anexos

**Files:**
- Modify: `apps/backend/pyproject.toml`
- Modify: `apps/backend/src/silo/storage/uploads.py`
- Create: `apps/backend/src/silo/services/procedure_extraction.py`
- Create: `apps/backend/src/silo/services/procedure_attachment_storage.py`
- Test: `apps/backend/tests/unit/test_procedure_extraction.py`
- Test: `apps/backend/tests/unit/test_procedure_attachment_storage.py`

**Interfaces:**
- Consumes attachment metadata and bytes from the procedure API.
- Produces `extract_document(filename, mime_type, bytes) -> ExtractedDocument` with chunks containing content, `page_number` and `slide_number` when available.
- Produces safe storage helpers for `/uploads/procedures/` and image validation using the existing upload path protections.

- [ ] **Step 1: Write failing extractor tests**

  Cover PDF page text, TXT/MD plain text, DOCX paragraphs, PPTX slide text, unsupported extension, empty document and a MIME/signature mismatch. Assert location metadata is retained.

- [ ] **Step 2: Run extractor tests to verify they fail**

  Run: `pytest apps/backend/tests/unit/test_procedure_extraction.py -v`

  Expected: FAIL because the extractor registry and format dependencies do not exist.

- [ ] **Step 3: Add extraction dependencies and implement the registry**

  Add pinned `pypdf`, `python-docx` and `python-pptx` dependencies. Implement a format registry keyed by validated MIME/extension, preserving PDF pages and PPTX slides. Return an explicit unsupported-format error instead of treating binary bytes as text.

- [ ] **Step 4: Write failing storage tests**

  Assert generated filenames never contain the original path, traversal is rejected, the SHA-256 is stable, images are validated with Pillow, the stored file is retrievable, and deletion removes the physical file.

- [ ] **Step 5: Run storage tests to verify they fail**

  Run: `pytest apps/backend/tests/unit/test_procedure_attachment_storage.py -v`

  Expected: FAIL because the `procedures` upload kind and attachment storage helper do not exist.

- [ ] **Step 6: Implement safe attachment storage**

  Add `procedures` as an upload kind, preserve the original bytes for documents and images, generate a server-side filename, compute SHA-256 and enforce a configurable per-attachment limit. Do not reuse the generic image upload endpoint that converts all files to WebP.

- [ ] **Step 7: Run all extraction/storage tests**

  Run: `pytest apps/backend/tests/unit/test_procedure_extraction.py apps/backend/tests/unit/test_procedure_attachment_storage.py -v`

  Expected: PASS.

- [ ] **Step 8: Commit**

  Run: `git add apps/backend/pyproject.toml apps/backend/src/silo/storage/uploads.py apps/backend/src/silo/services/procedure_extraction.py apps/backend/src/silo/services/procedure_attachment_storage.py apps/backend/tests/unit/test_procedure_* && git commit -m "feat: add secure procedure attachment extraction"`

### Task 3: Backend CRUD and attachment lifecycle API

**Files:**
- Create: `apps/backend/src/silo/services/procedure_portal.py`
- Create: `apps/backend/src/silo/api/routers/procedures.py`
- Modify: `apps/backend/src/silo/api/main.py`
- Test: `apps/backend/tests/unit/test_procedures_router.py`

**Interfaces:**
- Produces `GET /api/procedures`, `GET /api/procedures/{id}`, `POST /api/procedures`, `PUT /api/procedures/{id}` and `DELETE /api/procedures/{id}`.
- Produces multipart `POST /api/procedures/{id}/attachments`, `DELETE /api/procedures/{id}/attachments/{attachment_id}` and `POST /api/procedures/{id}/attachments/{attachment_id}/reprocess`.
- Returns procedure details with attachment metadata and processing state; upload returns `pending` before background extraction completes.

- [ ] **Step 1: Write failing API tests**

  Cover list/search, create/update/delete, permission failures, multipart image/document upload, attachment deletion, reprocess, inactive filtering and cleanup after parent deletion. Assert no binary content is returned in JSON.

- [ ] **Step 2: Run router tests to verify they fail**

  Run: `pytest apps/backend/tests/unit/test_procedures_router.py -v`

  Expected: FAIL because the router and service do not exist.

- [ ] **Step 3: Implement the service and routes**

  Follow existing `products`/`help` response conventions. Persist the DB row before scheduling extraction, update status to `processing`, `ready` or `error`, and make the reprocess endpoint idempotent. On deletion, delete child rows and physical files in a transaction-aware cleanup path.

- [ ] **Step 4: Run router tests to verify they pass**

  Run: `pytest apps/backend/tests/unit/test_procedures_router.py -v`

  Expected: PASS.

- [ ] **Step 5: Commit**

  Run: `git add apps/backend/src/silo/services/procedure_portal.py apps/backend/src/silo/api/routers/procedures.py apps/backend/src/silo/api/main.py apps/backend/tests/unit/test_procedures_router.py && git commit -m "feat: add general procedures CRUD API"`

### Task 4: Embedding, RAG retrieval and image-aware context

**Files:**
- Modify: `apps/backend/src/silo/services/embedding_write.py`
- Modify: `apps/backend/src/silo/ai/assistant_tools.py`
- Modify: `apps/backend/src/silo/ai/assistant_service.py`
- Create: `apps/backend/src/silo/ai/procedure_knowledge.py`
- Test: `apps/backend/tests/unit/test_procedure_embeddings.py`
- Test: `apps/backend/tests/unit/test_ai_procedure_retrieval.py`

**Interfaces:**
- Produces `upsert_procedure_embedding(procedure_id, title, content)` and `upsert_procedure_attachment_chunks(attachment_id, extracted_document)`.
- Extends `search_silo_knowledge` with `procedure` and `procedure_attachment` sources while preserving existing output fields.
- Adds source labels and citation metadata for procedure title, filename, page and slide.

- [ ] **Step 1: Write failing embedding and ranking tests**

  Assert procedure text and ready attachment chunks are indexed, inactive procedures are omitted, extraction-error attachments are omitted, an attachment outranks its procedure body for a troubleshooting query, and a relevant manual remains preferential for product-specific questions.

- [ ] **Step 2: Run AI tests to verify they fail**

  Run: `pytest apps/backend/tests/unit/test_procedure_embeddings.py apps/backend/tests/unit/test_ai_procedure_retrieval.py -v`

  Expected: FAIL because the new sources and embedding writers do not exist.

- [ ] **Step 3: Implement indexing and source weighting**

  Reuse the existing embedding metadata contract and chunking strategy. Add the procedure sources to the appropriate assistant scopes, apply source-aware ranking after base similarity, and retain original/adjusted scores. A document chunk must carry `sourceKind`, procedure title, attachment name and page/slide location.

- [ ] **Step 4: Implement image-derived context**

  Index manually supplied image descriptions and OCR output when present. Add a capability boundary for direct multimodal analysis: if the configured chat runtime declares vision support, pass the original image for a retrieved attachment; otherwise use the derived text and expose the image citation without pretending that pixels were interpreted.

- [ ] **Step 5: Run AI tests to verify they pass**

  Run: `pytest apps/backend/tests/unit/test_procedure_embeddings.py apps/backend/tests/unit/test_ai_procedure_retrieval.py -v`

  Expected: PASS.

- [ ] **Step 6: Commit**

  Run: `git add apps/backend/src/silo/services/embedding_write.py apps/backend/src/silo/ai/assistant_tools.py apps/backend/src/silo/ai/assistant_service.py apps/backend/src/silo/ai/procedure_knowledge.py apps/backend/tests/unit/test_procedure_* apps/backend/tests/unit/test_ai_procedure_retrieval.py && git commit -m "feat: index procedure attachments for AI retrieval"`

### Task 5: Procedures page and attachment management UI

**Files:**
- Create: `apps/frontend/src/app/admin/procedures/page.tsx`
- Create: `apps/frontend/src/app/admin/procedures/page.test.tsx`
- Create: `apps/frontend/src/app/admin/procedures/components/procedure-form.tsx`
- Create: `apps/frontend/src/app/admin/procedures/components/procedure-list.tsx`
- Create: `apps/frontend/src/app/admin/procedures/components/procedure-attachment-list.tsx`
- Modify: `apps/frontend/src/components/admin/sidebar/sidebar.tsx`
- Modify: `apps/frontend/src/components/ui/markdown-editor.tsx` only if an existing upload/editor boundary requires it
- Modify: `packages/engine/src/contracts/dto/index.ts` if the DTO barrel exists

**Interfaces:**
- Consumes the procedure API and DTOs from Task 3.
- Produces a menu item visible only with `procedures:view`, CRUD controls gated by `procedures:manage`, and attachment status/preview/removal controls.

- [ ] **Step 1: Write failing page tests**

  Assert menu visibility by permission, empty state, list/search, create/edit form, Markdown content, attachment names/statuses, unsupported-file error, image preview, document download/open and delete confirmation.

- [ ] **Step 2: Run frontend tests to verify they fail**

  Run: `npm --prefix apps/frontend test -- --run src/app/admin/procedures/page.test.tsx`

  Expected: FAIL because the route and components do not exist.

- [ ] **Step 3: Implement page and components**

  Use existing admin page, form, modal, Markdown editor and toast conventions. Upload attachments directly to the procedure endpoint so documents are not routed through the image-to-WebP uploader. Show `pending`, `processing`, `ready` and `error` states; allow manual reprocess for errors.

- [ ] **Step 4: Run frontend tests to verify they pass**

  Run: `npm --prefix apps/frontend test -- --run src/app/admin/procedures/page.test.tsx`

  Expected: PASS.

- [ ] **Step 5: Commit**

  Run: `git add apps/frontend/src/app/admin/procedures apps/frontend/src/components/admin/sidebar/sidebar.tsx packages/engine/src/contracts && git commit -m "feat: add general procedures management page"`

### Task 6: End-to-end verification and operational documentation

**Files:**
- Modify: `docs/ai-assistant.md`
- Modify: `docs/backend.md`
- Test: `apps/backend/tests/integration/test_general_procedures_flow.py` (create if integration test layout supports it)
- Test: `apps/frontend/src/app/admin/procedures/page.test.tsx` additions for the complete flow

**Interfaces:**
- Consumes the completed API, extraction and RAG behavior from Tasks 1–5.
- Produces documented backup/storage requirements and a verified create → process → search → cite → delete flow.

- [ ] **Step 1: Write the integration test**

  Create a procedure, attach a fixture PDF and image description, wait/process the attachment, query the knowledge search, assert the attachment citation and priority, then delete the procedure and assert the file/index are gone.

- [ ] **Step 2: Run the focused integration test**

  Run: `pytest apps/backend/tests/integration/test_general_procedures_flow.py -v`

  Expected: FAIL until all previous tasks are integrated.

- [ ] **Step 3: Document configuration and backup behavior**

  Record supported formats, attachment limits, extraction statuses, vision fallback behavior, the `/uploads/procedures/` volume and the requirement to back it up alongside PostgreSQL.

- [ ] **Step 4: Run the full relevant verification suite**

  Run: `pytest apps/backend/tests/unit/test_general_procedure_schema.py apps/backend/tests/unit/test_procedure_extraction.py apps/backend/tests/unit/test_procedure_attachment_storage.py apps/backend/tests/unit/test_procedures_router.py apps/backend/tests/unit/test_procedure_embeddings.py apps/backend/tests/unit/test_ai_procedure_retrieval.py -v`

  Run: `npm --prefix apps/frontend test -- --run src/app/admin/procedures/page.test.tsx`

  Expected: all focused backend and frontend tests PASS.

- [ ] **Step 5: Commit**

  Run: `git add docs/ai-assistant.md docs/backend.md apps/backend/tests/integration/test_general_procedures_flow.py apps/frontend/src/app/admin/procedures/page.test.tsx && git commit -m "test: verify general procedure knowledge flow"`
