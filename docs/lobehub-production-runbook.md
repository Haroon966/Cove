# LobeHub Integration Production Runbook

## Preconditions

- `npm ci` completed successfully.
- Tauri toolchain installed for target OS (`rustup`, system deps, `cargo`).
- Local model/provider credentials configured in `Settings`.
- Backup exported before migration (`Settings -> Backup`).
- Verify `src-tauri/capabilities/default.json` exposes only intended permission sets.

## Automated Gate (Blocking)

Run one command and require all checks to pass:

- `npm run release:verify`

This executes:

- `npm run build`
- `npx vitest run src/e2e/parityCriticalScenarios.test.ts src/features/integration/majorFlows.test.ts`
- `cargo check` in `src-tauri`

## Full Validation Matrix

1. Static and build checks:
   - `npm run lint`
   - `npm run build`
   - `cargo check --manifest-path src-tauri/Cargo.toml`
2. Test tiers:
   - Unit/integration: `npm run test`
   - Parity-critical E2E suite: `npm run test:e2e`
3. Desktop smoke (manual):
   - Deep-link route dispatch (`cove://chat`, `cove://agents`, `cove://knowledge`, `cove://discover`)
   - Notification delivery on background assistant response
   - Agent tool flow with policy gate and trace visibility
   - Knowledge ingestion/retrieval and source-linking per session

## Security and Reliability Checklist

- Confirm `agent_workspace_path` uses least privilege and path normalization is active.
- Confirm shell/file tools are policy-gated and denied/confirm paths are tested.
- Confirm API keys are never emitted in logs or UI traces.
- Confirm backend audit logs and runtime metrics are writable/readable from Settings.
- Confirm backup/restore succeeds before packaging.

## Packaging and Release

1. Bump app version and sync metadata:
   - `npm run version:sync`
2. Produce desktop artifacts:
   - `npm run tauri build`
3. Validate artifacts in a clean user profile:
   - first-run config
   - restore backup
   - run parity smoke list
4. Publish release notes with:
   - notable features
   - migration notes
   - rollback instructions

## Incident Response and Rollback

1. Contain:
   - stop rollout and pin users to previous stable package.
2. Recover:
   - reinstall previous known-good package.
   - restore backup JSON via Settings import.
3. Mitigate:
   - disable risky feature flags in config when hotfixing.
4. Learn:
   - export backend audit logs and traces for root cause analysis.
   - add regression tests for the incident path before re-release.

