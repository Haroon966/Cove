# LobeHub to Cove Migration Matrix

This matrix defines how each LobeHub module family is integrated into Cove.

## Strategy Codes

- `direct-port`: import/adapt code with minimal rewrite.
- `adapter-port`: preserve behavior through Cove-specific wrappers.
- `rewrite`: recreate behavior using Cove-native architecture.

## Matrix

| LobeHub Module Family | Primary Source Locations | Cove Destination | Strategy | Notes |
|---|---|---|---|---|
| Conversation flow runtime | `packages/agent-runtime`, `packages/conversation-flow` | `src/agent/runtime/*` | adapter-port | Keep Cove hooks API stable while replacing internals. |
| Provider runtime abstraction | `packages/model-runtime` | `src/api/runtime/*` | adapter-port | Normalize capabilities and provider metadata in one registry. |
| Builtin tools and policies | `packages/builtin-tool-*`, `packages/builtin-tools` | `src/agent/tools/*`, `src/agent/policy/*` | rewrite | Match Tauri security and permission model. |
| MCP client integration | `src/services/mcp`, tool routers | `src/features/mcp/*`, `src-tauri/src/mcp.rs` | rewrite | Build desktop-safe manager for local/remote MCP servers. |
| Agent builder and template flows | `packages/agent-templates`, agent builder tools | `src/features/agents/*`, `src/pages/AgentsPage.tsx` | adapter-port | Preserve user-level behaviors with Cove UI conventions. |
| Group orchestration/task scheduling | `packages/agent-manager-runtime`, task tools | `src/agent/runtime/group.ts`, `src-tauri/src/scheduler.rs` | rewrite | Backed by local scheduler for single-user mode. |
| Knowledge base ingestion/RAG | knowledge tools + file loaders | `src/features/knowledge/*`, `src-tauri/src/knowledge.rs` | rewrite | Local-first indexing in SQLite/vector sidecar. |
| Session/message/topic stores | `src/store/*` domain slices | `src/store/*`, `src-tauri/src/db.rs` | adapter-port | Use store split while preserving existing chat behavior. |
| Settings/provider configuration | `src/features/Setting`, env/config modules | `src/components/Settings.tsx`, `src/config/*` | adapter-port | Add provider capabilities, tool policy, MCP controls. |
| Discover/market surfaces | discover features/market SDK | `src/pages/DiscoverPage.tsx`, `src/features/discover/*` | rewrite | Local curated catalog plus optional remote feeds. |
| Theme/system design tokens | style and token modules | `src/theme/*`, `src/App.css` | rewrite | Keep current look-and-feel but add scalable token layers. |
| Desktop bridge (Electron-specific) | `apps/desktop/*` | `src-tauri/src/*` | rewrite | Rebuild with Tauri commands/events/deep-link hooks. |
| Server routes (Next.js/tRPC) | `src/app/(backend)`, `src/server/routers/*` | `src-tauri/src/*` + local service adapters | rewrite | Remove Next dependency; keep domain contracts. |
| Auth/multi-user stack | Better Auth + server routes | local profile/session model | rewrite | Single-user local-first now; remote-ready abstraction later. |
| Testing and quality workflows | vitest/playwright + CI flows | `src/**/*.test.*`, `tests/integration`, `e2e/*` | adapter-port | Keep tooling stack aligned with Cove build. |

## Execution Order

1. Extract portable runtime contracts.
2. Build adapter layer to keep current Cove UI working.
3. Migrate storage schema and stores.
4. Port feature surfaces incrementally behind flags.
5. Expand testing and observability as each feature lands.

## Risk Controls

- Keep all major migrations behind feature flags.
- Avoid destructive schema changes; use additive migrations.
- Preserve existing command paths (`invoke`) until new APIs are validated.
- Add trace-level logs for runtime and tool execution during rollout.
