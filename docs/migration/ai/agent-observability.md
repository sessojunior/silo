# Agent Observability Contract

This document defines the local metrics and alerting contract for the SILO agent during the migration.

## Metrics

- `ai_graph_runs_total`
- `ai_graph_duration_seconds`
- `ai_graph_mode_total`
- `ai_graph_fallback_total`
- `ai_graph_error_total`
- `ai_graph_cache_hit_total`
- `ai_graph_tool_calls_total`
- `ai_graph_tool_denials_total`
- `ai_graph_tool_timeouts_total`
- `ai_graph_recursion_guard_total`
- `ai_graph_sse_disconnect_total`
- `ai_graph_dataset_status_total`
- `ai_graph_artifact_status_total`
- `ai_graph_model_calls_total`

## Safe Labels

Allowed labels must stay low-cardinality and never include:

- raw question text
- raw user id
- raw thread id
- raw dataset id
- prompt content
- tool arguments
- tool results

Recommended labels:

- `mode`
- `scope`
- `status`
- `source_kind`
- `reason`
- `result_kind`

## Alerts

- High fallback rate: notify when fallback becomes the dominant mode for a sustained period.
- Recursion guard spikes: notify when graphs exceed the expected step budget.
- SSE disconnect spikes: notify when streaming disconnects increase sharply.
- Tool denial spikes: notify when the planner starts asking for forbidden tools.
- Artifact failures: notify when PDF or visualization generation starts failing repeatedly.

## Notes

- The contract is intentionally local and redacted. It is safe to export into dashboards and alert rules without exposing prompts or reasoning.
- Any future telemetry backend must preserve the same label hygiene.
