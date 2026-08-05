# Fase 2.18 — Resolução LangGraph/LangChain/Ollama

Data: 2026-07-22

## Objetivo

Confirmar pelo `uv lock --check` que `langgraph==1.2.9`, `langchain-core==1.4.9` e `langchain-ollama==1.1.0` resolvem juntos em Windows e Linux/Python 3.13.14. Falha de resolução bloqueia a fase; não afrouxar pins isoladamente.

## Comandos executados

Diretório: `backend`

```powershell
$env:Path = "$env:USERPROFILE\.local\bin;$env:Path"
uv lock --check
uv run --locked python --version
uv run --locked python -c "import importlib.metadata as m; print('langgraph=' + m.version('langgraph')); print('langchain-core=' + m.version('langchain-core')); print('langchain-ollama=' + m.version('langchain-ollama'))"
uv sync --locked --all-groups --python-platform x86_64-unknown-linux-gnu --dry-run
```

## Resultados

Windows/local:

```text
Python 3.13.14
langgraph=1.2.9
langchain-core=1.4.9
langchain-ollama=1.1.0
```

Linux dry-run:

```text
Resolved 87 packages in 1ms
Would use project environment at: .venv
Resolved 87 packages in 1ms
Would download 26 packages
Would uninstall 28 packages
Would install 26 packages
```

O dry-run Linux mostrou substituições esperadas de wheels/plataforma, por exemplo remoção de pacotes Windows-only como `pywin32`/`colorama` e adição de `uvloop`, sem alteração do lock e sem afrouxar pins.

## Status

Aprovada.
