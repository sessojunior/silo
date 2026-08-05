# syntax=docker/dockerfile:1.7

ARG PYTHON_IMAGE=python:3.13.14-slim-bookworm@sha256:dd86541a59b252667f4c12f8b2ee17216de37dd65ac773bf097bef996fa78860
ARG UV_IMAGE=ghcr.io/astral-sh/uv:0.11.28@sha256:5c3ab83183a73c5d319a77009eb425b60d5bb937f339fb7876788ebf567baf48

FROM ${UV_IMAGE} AS uv

FROM ${PYTHON_IMAGE} AS python-base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 10001 silo \
    && useradd \
        --system \
        --uid 10001 \
        --gid silo \
        --home-dir /app \
        --no-create-home \
        --shell /usr/sbin/nologin \
        silo

COPY --from=uv /uv /usr/local/bin/uv

RUN python -c "import sys; assert sys.version_info[:2] == (3, 13), sys.version"

FROM python-base AS deps

COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project --compile-bytecode

FROM deps AS runtime

COPY README.md ./
COPY src ./src

RUN uv sync --locked --no-dev --compile-bytecode \
    && chown -R silo:silo /app

ENV PATH="/app/.venv/bin:${PATH}" \
    LANGSMITH_TRACING=false \
    PYTHONPATH=/app/src \
    PORT=4001

USER silo
ENTRYPOINT ["/usr/bin/tini", "--"]

FROM runtime AS api

COPY alembic.ini ./
COPY migrations ./migrations

EXPOSE 4001
CMD ["uvicorn", "silo.api.main:app", "--host", "0.0.0.0", "--port", "4001"]

FROM runtime AS worker

ENV WORKER_HEALTH_STATE_PATH=/tmp/silo-worker-health.json \
    WORKER_HEALTH_STALE_SECONDS=30

HEALTHCHECK --interval=10s --timeout=3s --retries=12 CMD ["python", "-m", "silo.worker.healthcheck"]

CMD ["python", "-m", "silo.worker.main"]
