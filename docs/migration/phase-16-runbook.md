# Phase 16 Runbook

This runbook documents the local orchestration support for the production cutover.
It does not claim that the production window was executed here.

## Available commands

- `npm run deploy:preflight`
- `npm run deploy:rehearsal`
- `npm run deploy:cutover`
- `npm run deploy:rollback`

All four commands are backed by `scripts/deploy/cutover-runbook.mjs`.

## Input state

The runbook accepts an optional JSON state file via `--state` or `PHASE16_STATE_PATH`.
The file can provide:

- `goNoGo`: boolean and string fields for the preflight checklist.
- `commands`: shell commands for rehearsal/cutover/rollback dry-run execution.

Example keys used by the preflight:

- `backupRecentWithin7Days`
- `restoreTestedWithin7Days`
- `nodeImageDigest`
- `pythonImageDigest`
- `rollbackAccessAvailable`
- `noDestructiveMigration`
- `noOpenIncidents`
- `finalAiAgentMode`
- `aiGraphVersion`
- `promptVersion`
- `toolCatalogVersion`
- `ollamaImageDigest`
- `chatModelDigest`
- `embeddingModelDigest`
- `hybridGateApproved`
- `hybridGateDisabled`
- `usersNotified`
- `lowTrafficWindowApproved`

## Modes

- `preflight` validates the go/no-go checklist and writes `artifacts/deploy/phase-15-16-preflight.json`.
- `rehearsal` walks the full phase 15 staging rehearsal sequence and writes `phase-15-16-rehearsal.json`.
- `cutover` walks the phase 16 production sequence and writes `phase-15-16-cutover.json`.
- `rollback` walks the production rollback sequence and writes `phase-15-16-rollback.json`.

When a command is not provided, the runbook stays in manual mode and records the step as such.

## Operational Notes

- The script is intentionally conservative and does not invent missing prerequisites.
- The local repo now contains the load, soak, SBOM, audit, chaos and deploy entry points needed by the gate.
- Real staging and production execution still requires the external environment, credentials and window approval.
