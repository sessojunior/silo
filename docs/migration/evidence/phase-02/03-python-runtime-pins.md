# Fase 2.3 — pins de runtime Python

Data: 2026-07-22  
Status: concluído

## Arquivos criados

- `backend/.python-version`
- `backend/pyproject.toml`
- `backend/Dockerfile`
- `backend/tests/unit/test_python_runtime_version.py`

## Decisões fixadas

```text
.python-version = 3.13.14
requires-python = "==3.13.*"
Docker base image = python:3.13.14-slim-bookworm
```

O `Dockerfile` criado nesta etapa contém apenas o pin mínimo de imagem/runtime. A versão multi-stage final com targets `api` e `worker`, usuário não-root e lock congelado permanece para a Fase 2.13.

## Validação executada

```text
phase2_3 python runtime pins OK

git diff --check
OK, com avisos CRLF apenas em arquivos preexistentes de embeddings.
```
