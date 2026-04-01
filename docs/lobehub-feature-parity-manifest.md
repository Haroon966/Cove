# LobeHub Feature Parity Manifest for Cove

This manifest tracks end-to-end parity of LobeHub capabilities inside Cove.

Legend:
- `native`: Implemented directly in Cove codebase.
- `adapted`: Implemented in Cove with reduced or modified behavior.
- `pending`: Not yet implemented.

## Reference Inputs

- LobeHub source reference: `lobehub-reference/lobehub` (canary snapshot archive/cloned source).
- Cove baseline modules:
  - `src/pages/ChatPage.tsx`
  - `src/components/ChatPanel.tsx`
  - `src/components/Settings.tsx`
  - `src/hooks/useStreamingChat.ts`
  - `src/hooks/useAgentStreamingChat.ts`
  - `src/agent/tools.ts`
  - `src-tauri/src/lib.rs`
  - `src-tauri/src/db.rs`
  - `src-tauri/src/config.rs`

## Feature Domains

### 1) Core Conversation UX

| Capability | LobeHub Reference | Cove Target | Status |
|---|---|---|---|
| Streaming chat | `packages/agent-runtime`, `src/services/aiChat` | `src/hooks/useStreamingChat.ts`, `src/components/ChatPanel.tsx` | native |
| Markdown/code rendering | `src/features/Conversation` | `src/components/MarkdownContent.tsx` | native |
| Multi-session chat | `src/store/session` | `src/pages/ChatPage.tsx`, `src/components/SessionList.tsx`, `src-tauri/src/db.rs` | native |
| Session search | `src/server/routers/lambda/session` | `src-tauri/src/db.rs::search_sessions` | native |
| Branching conversations | `conversation-flow`, topic/thread stores | `src/features/conversations/branching/*` + DB migrations | pending |
| Regenerate/edit from prior message | chat runtime/session operations | `src/pages/ChatPage.tsx` | native |

### 2) Model Runtime and Provider Ecosystem

| Capability | LobeHub Reference | Cove Target | Status |
|---|---|---|---|
| Unified provider abstraction | `packages/model-runtime` | `src/api/runtime/*`, `src/types/providers.ts` | pending |
| OpenAI-compatible | provider adapters | `src/api/openai.ts` | native |
| Ollama local models | provider adapters | `src/api/ollama.ts` | native |
| Provider capability registry | provider metadata maps | `src/config/providerRegistry.ts` | pending |
| Model discovery by provider | model runtime client | `src/api/providers/*` + settings UI | adapted |
| Vision model support | multimodal adapters | `src/hooks/useVisionCapability.ts` | adapted |
| Text-to-image model surface | image provider adapters | `src/features/media/image-generation/*` | pending |
| TTS/STT provider surface | audio adapters | `src/features/media/voice/*` + backend commands | pending |

### 3) Agent Runtime and Tooling

| Capability | LobeHub Reference | Cove Target | Status |
|---|---|---|---|
| Tool/function-calling loop | `packages/agent-runtime` | `src/hooks/useAgentStreamingChat.ts` | native |
| Multi-turn tool execution | runtime instruction loop | `src/hooks/useAgentStreamingChat.ts` + `src/agent/tools.ts` | adapted |
| Tool approval policy | tool middleware/policies | `src/agent/policy/*` + Tauri enforcement | pending |
| Tool audit trace | observability tracing | DB trace tables + `src/features/traces/*` | pending |
| Shell/file tools | builtin tool packages | `src/agent/tools.ts`, `src-tauri/src/lib.rs` | native |
| Safe command sandboxing | tool guards | `src-tauri/src/lib.rs` + capabilities | adapted |

### 4) MCP and Skill Ecosystem

| Capability | LobeHub Reference | Cove Target | Status |
|---|---|---|---|
| MCP client manager | `src/services/mcp`, builtin MCP tools | `src/features/mcp/*`, `src-tauri/src/mcp.rs` | pending |
| MCP server catalog | skill/market integrations | `src/features/skills/catalog/*` | pending |
| MCP install/config UI | skill management panels | `src/components/Settings.tsx` extension | pending |
| Builtin skill library | `packages/builtin-skills` | `src/skills/*` + runtime registration | pending |

### 5) Knowledge Base and File Intelligence

| Capability | LobeHub Reference | Cove Target | Status |
|---|---|---|---|
| File upload and parsing | file-loader packages | `src/features/knowledge/upload/*` + Tauri fs | pending |
| Knowledge chunking/indexing | KB tool/runtime modules | `src-tauri/src/knowledge.rs` + DB/vector index | pending |
| Retrieval-augmented responses | context engine + KB tools | `src/hooks/useAgentStreamingChat.ts` integration | pending |
| KB management UI | KB screens | `src/pages/KnowledgePage.tsx` | pending |

### 6) Agents, Groups, Workspace, Projects, Schedule

| Capability | LobeHub Reference | Cove Target | Status |
|---|---|---|---|
| Agent builder | `builtin-tool-agent-builder` + feature screens | `src/pages/AgentsPage.tsx` | pending |
| Agent templates/market import | `packages/agent-templates`, market SDK | `src/features/agents/templates/*` | pending |
| Group/multi-agent orchestration | `agent-manager-runtime` | `src/agent/runtime/group.ts` | pending |
| Workspace/project organization | workspace/project domains | `src/features/workspace/*` | pending |
| Scheduled tasks/jobs | schedule/task tooling | `src-tauri/src/scheduler.rs` + UI | pending |

### 7) Discovery and Marketplace

| Capability | LobeHub Reference | Cove Target | Status |
|---|---|---|---|
| Agent market browse/install | discover assistants | `src/pages/DiscoverPage.tsx` | pending |
| Skill/MCP discovery | MCP marketplace surfaces | `src/features/skills/discover/*` | pending |

### 8) Desktop and Platform

| Capability | LobeHub Reference | Cove Target | Status |
|---|---|---|---|
| Desktop app shell | desktop app package | `src-tauri/*` | native |
| Tray, shortcuts, focus | desktop integrations | `src-tauri/src/lib.rs` | native |
| Deep links/notification bridge | desktop bridge services | `src-tauri/src/desktop_bridge.rs` | pending |
| Backup/export/restore | data tooling | `src-tauri/src/db.rs` + settings UI | native |

### 9) Theming, UX, Accessibility

| Capability | LobeHub Reference | Cove Target | Status |
|---|---|---|---|
| Dark/light/system themes | theming system | `src/App.css`, `src/components/Settings.tsx` | native |
| Theme token customization | UI token system | `src/theme/tokens.ts` + settings controls | adapted |
| Mobile-responsive layout | responsive feature modules | CSS/layout refactors across `src/components/*` | adapted |
| A11y pass | ui component standards | keyboard/focus/aria updates across UI | pending |

### 10) Security, Observability, QA, Release

| Capability | LobeHub Reference | Cove Target | Status |
|---|---|---|---|
| Structured error model | runtime/server error taxonomy | `src/errors/*` + backend error envelopes | pending |
| Audit-safe logging | observability packages | `src/logging/*`, `src-tauri/src/logging.rs` | pending |
| Metrics/traces | telemetry instrumentation | `src/observability/*` | pending |
| Unit tests | vitest suites | `src/**/*.test.ts(x)` | adapted |
| Integration tests | service/db/invoke tests | `tests/integration/*` | pending |
| E2E regression tests | playwright workflows | `e2e/*` | pending |
| Packaging and release runbook | desktop release scripts | `docs/release/*` | pending |

## Current Integration Milestone

- Phase 0 artifacts created.
- Foundation coding underway for:
  - state/domain store split,
  - schema/version extensions,
  - runtime adapter boundaries.
