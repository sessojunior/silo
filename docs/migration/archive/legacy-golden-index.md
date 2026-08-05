# Legacy Golden Index

This index maps the preserved legacy golden fixtures that still back the
migration contracts.

The canonical fixture data continues to live under
`tests/fixtures/legacy-golden/`. This document is the human-readable index for
that archive and records the main coverage groups that remain available for
comparison and rollback work.

## Coverage groups

| Group | Representative fixture path | Purpose |
| --- | --- | --- |
| Shared harness | `tests/fixtures/legacy-golden/api.warmup.direct.json` | Legacy smoke and warmup baseline. |
| Shared normalization | `tests/fixtures/legacy-golden/normalization.json` | Input/output normalization reference. |
| Auth | `tests/fixtures/legacy-golden/phase1_11.auth_bcryptjs_vectors.json` | Password hashing compatibility vectors. |
| Chat | `tests/fixtures/legacy-golden/phase1_12.chat_ws.realtime.json` | Realtime chat contract coverage. |
| AI assistant | `tests/fixtures/legacy-golden/phase1_13.ai_assistant_sse.bytes.json` | SSE and response contract golden. |
| Uploads | `tests/fixtures/legacy-golden/phase1_14.upload_images.webp_pixels.json` | Upload/image handling reference. |
| Reports | `tests/fixtures/legacy-golden/phase1_15.report_pdfs.visual.json` | PDF rendering and visual baseline. |
| Email | `tests/fixtures/legacy-golden/phase1_16.email_smtp.contents.json` | SMTP payload and delivery contract. |
| RAG cache | `tests/fixtures/legacy-golden/phase1_17.ai_rag_cache.outputs.json` | Assistant cache and retrieval baseline. |
| Kafka worker | `tests/fixtures/legacy-golden/phase1_18.worker_kafka.dataflow.json` | Worker and Kafka dataflow oracle. |
| Repaired contract | `tests/fixtures/legacy-golden/phase1_23.ai_repaired_contract.json` | Repaired assistant contract baseline. |
| Status semantics | `tests/fixtures/legacy-golden/phase1_24.status_semantics_cross_fixture.json` | Shared status semantics snapshot. |
| Known invalid report | `tests/fixtures/legacy-golden/phase1_27.report_known_invalid.json` | Negative report contract reference. |
| Visualization | `tests/fixtures/legacy-golden/phase1_28.ai_visualization_render_contract.json` | Visualization render oracle. |
| Canonical datasets | `tests/fixtures/legacy-golden/phase1_29.report_pdf_canonical_datasets.json` | PDF dataset checksum reference. |

## Notes

- The archive is intentionally read-only.
- Legacy contracts may continue to read from these fixtures until the oracle
  suite is retired in a separate PR.
