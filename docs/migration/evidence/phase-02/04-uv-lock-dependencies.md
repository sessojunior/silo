# Fase 2.4 — dependências e uv.lock

Data: 2026-07-22  
Status: concluído

## Resultado

`backend/pyproject.toml` foi atualizado com:

```toml
[tool.uv]
exclude-newer = "2026-07-20T23:59:59Z"
```

As dependências diretas da seção 2.3 foram fixadas com versões exatas e `backend/uv.lock` foi gerado.

## Dependências runtime diretas

```text
aiosmtplib==5.1.2
alembic==1.18.5
authlib==1.7.2
bcrypt==5.0.0
fastapi==0.139.2
httpx==0.28.1
langchain-core==1.4.9
langchain-ollama==1.1.0
langgraph==1.2.9
pgvector==0.5.0
pillow==12.3.0
psycopg[binary,pool]==3.3.4
pydantic==2.13.4
pydantic-settings==2.14.2
python-multipart==0.0.32
reportlab==5.0.0
sqlalchemy[asyncio]==2.0.51
uvicorn[standard]==0.51.0
```

## Dependências dev diretas

```text
mypy==2.3.0
pytest==9.1.1
pytest-asyncio==1.4.0
pytest-cov==7.1.0
respx==0.23.1
ruff==0.15.22
testcontainers==4.14.2
```

As ferramentas sem versão explícita na tabela (`pytest-asyncio`, `pytest-cov`, `respx`, `mypy`, `testcontainers`) foram resolvidas com:

```powershell
uv add --dev --bounds exact pytest-asyncio pytest-cov respx mypy testcontainers
```

sob o cutoff `exclude-newer`.

## Validação executada

```text
uv lock --check
Resolved 87 packages

uv sync --locked --all-groups
Resolved 87 packages
Checked 85 packages

uv run --locked python --version
Python 3.13.14

phase2_4 dependency pins OK

git diff --check
OK, com avisos CRLF apenas em arquivos preexistentes de embeddings.
```

Observação: `.venv` foi criada pelo `uv`; a atualização versionada de `.gitignore` permanece para a Fase 2.15 conforme o plano.
