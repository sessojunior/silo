# Agent Chaos Contracts

This document captures the failure scenarios we keep exercising locally for the AI assistant, API and worker.

## Scenarios

- Ollama unavailable.
- Ollama slow or disconnected.
- Ollama returns malformed structured output.
- Embedding dimension mismatch.
- Tool timeout.
- DB pool exhaustion.
- Dataset registry full or corrupted.
- Renderer failure for charts, Mermaid or PDF.
- PDF volume read-only or full.
- Graph recursion guard trip.
- SSE cancel and disconnect.
- Structured response validation failure.

## Expected Outcomes

- Assistant falls back to the safe response path or returns the expected error.
- API CRUD endpoints remain healthy when the model runtime fails.
- Worker processing continues without importing the model runtime.
- No leaked prompt, tool argument or reasoning content appears in logs.
- No inconsistent artifact is persisted after a failed run.

## Current Local Coverage

- Unit tests cover sanitized observability, auth and transport hardening.
- Route-level tests cover the assistant, chat, monitoring and upload flows.
- Import-boundary tests keep the worker away from LangGraph and LangChain.

## Open Items

- Long-running soak and live chaos still need staging execution before the migration gate can be considered fully complete.
