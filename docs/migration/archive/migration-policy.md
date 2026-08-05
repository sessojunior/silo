# Future Migration Policy

This note captures the policy boundary for any future non-additive migration
work after the current cutover window.

## Required safeguards

- Take a fresh backup and verify the restore before any destructive change.
- Open one dedicated PR per destructive migration step.
- Keep the rollback path documented before merging the change.
- Update the contract suite and the evidence index together with the code.
- Do not bundle schema, retention and compatibility changes into the same
  unreviewed change set.

## Operational rule

If a change removes data, rewrites incompatible state or changes the graph or
schema contract in a non-additive way, it must wait for a new approved window.

## Current scope boundary

The legacy Node sources remain available only as compatibility oracles until
the migration contracts that still reference them are retired.
