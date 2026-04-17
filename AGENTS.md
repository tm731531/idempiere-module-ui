# Agent Team Configuration — idempiere-module-ui (Aesthetics UI)

## Roles

| Agent | Model | Role | Phase |
|-------|-------|------|-------|
| architect | opus | Metadata-driven form design, AD_Tab/Field decisions, OSGi architecture | Design |
| implementer | sonnet | Vue components, composables, API modules, Vitest tests | Build |
| scanner | haiku | File scan, component inventory, test result parsing | Recon |

## Workflow Override Rules

### Model Selection
- opus → AD_Tab_ID decisions, metadata architecture, OSGi/WAB deployment issues
- sonnet → ALL Vue/TypeScript implementation (components, composables, api/, views/, tests)
- haiku → scanning files, reading test output, listing components ONLY

### iDempiere Iron Rules (never violate)
- Never hardcode reference IDs — query from AD metadata
- Never hardcode FK table lists — use `checkQuickCreateEligibility()`
- Never use `!0` checks — use `=== null` / `=== undefined`
- Never use `action=update` for Felix bundle update — always `action=install` + `uploadid`

### Debug Limit
After 3 failed fix attempts: STOP, report findings, wait for user.

### Branch Rule
Non-main/master branch: no confirmation needed.

### Verification
Before claiming "done": run `npm run test` + `npm run type-check`, paste output.

### Subagent Context
Every subagent starts fresh. All rules must be in this file or CLAUDE.md.
