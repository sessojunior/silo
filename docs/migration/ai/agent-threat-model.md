# Agent Threat Model

This document records the main risks we harden against for the SILO AI assistant and the corresponding controls in the current migration.

## Scope

- Direct prompt injection from user input.
- Indirect prompt injection from retrieved content.
- Tool confusion and argument smuggling.
- Cross-user cache leakage.
- IDOR on activity, problem, dataset and artifact references.
- Excessive agency, loops and denial of service.
- Context poisoning and data exfiltration.
- Hallucinated numbers and source kind confusion.
- SVG, Mermaid and output injection.
- Path and URL injection.
- Duplicate or orphan PDF artifacts.

## Controls

- Keep the graph deterministic by default and gate hybrid mode behind explicit approval.
- Validate tool arguments before execution and reject unknown tool paths.
- Scope cache entries by user and thread and treat legacy cache entries without the repaired signature as misses.
- Redact prompts, reasoning, tool arguments, tool results and history from logs and traces.
- Keep the worker free from LangGraph/LangChain imports so operational jobs do not inherit agent tooling.
- Restrict artifacts to allowlisted same-origin paths and safe MIME types.
- Render Mermaid with strict security settings and text-only diagram definitions.
- Use source-kind and dataset checks to keep factual outputs grounded in the right storage layer.

## Residual Risk

- The assistant still depends on live model behavior for some paths, so staging validation remains mandatory before any mode change.
- External prompt injection in user-provided documents must still be considered unsafe until it is normalized and validated by the backend.
