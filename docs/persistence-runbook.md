# Persistence Runbook

This runbook covers production-safe rollout and recovery for Cove persistence changes.

## Storage Model

- Desktop source of truth: SQLite at app data path (`cove.db`).
- Config lives in SQLite table `app_config` (`key = "global"`).
- Legacy `config.json` is used only for one-time migration if no SQLite config row exists.
- Browser/dev mode uses local fallback storage for testing parity.

## Pre-Upgrade Checklist

1. Export app backup from Settings.
2. Copy app data directory for rollback safety.
3. Confirm desktop build passes:
   - `npm run build`
   - `npm run test`
   - `cd src-tauri && cargo check`

## Migration Expectations

- On first `config_load`, if `app_config` has no row, Cove imports `config.json`.
- If legacy JSON is invalid, Cove falls back to defaults and repairs persisted config.
- If SQLite config row is invalid JSON, Cove falls back to defaults and repairs row.

## Validation Steps (Canary)

1. Launch upgraded app on canary machine.
2. Confirm Settings values are retained after restart.
3. Create a chat, save messages, restart, and verify history remains.
4. Export backup and inspect JSON includes `config`.
5. Import backup and verify config + sessions restore correctly.

## Rollback Procedure

1. Close Cove.
2. Restore previous app binary/package.
3. Restore app data directory backup.
4. Relaunch and verify sessions/settings.

If partial corruption is suspected:
- keep a copy of current app data for forensics
- restore known-good backup
- re-run upgrade in staging with copied data before production retry

## Incident Triage Notes

- Symptoms: missing settings, defaults unexpectedly applied, backup import mismatch.
- Inspect:
  - app data `cove.db` integrity
  - `app_config` row presence and JSON validity
  - backup JSON `config` payload
- Escalate with:
  - app version
  - platform
  - reproduction steps
  - sanitized logs/errors (never include raw API keys)
