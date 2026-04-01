# PRD: LobeHub Full Feature Integration for Cove

## Objective

Integrate all relevant LobeHub capabilities into Cove with production-grade quality, while preserving existing user flows and stability.

This PRD checklist is the execution tracker we will use feature-by-feature until all items are complete.

Legend:
- `[x]` fully integrated and validated
- `[ ]` not fully integrated yet

## Scope and Constraints

- Target app: `Cove` (React + Vite + Tauri)
- Reference source: `lobehub-reference/lobehub`
- Integration strategy: native adoption/adaptation inside Cove architecture
- Quality bar for “fully integrated”:
  - implemented in UI + backend/runtime where needed
  - persisted correctly (if data feature)
  - error handling present
  - basic tests (unit/integration) present
  - build passes

## Feature Checklist

### 1) Core Chat Experience

- [x] Streaming chat responses
- [x] Session create/list/select/delete
- [x] Session search
- [x] Edit-and-regenerate message flow
- [x] Branching conversations (full UX + history tree navigation)
- [x] Artifact panel and artifact lifecycle
- [x] Chain-of-thought style execution trace visualization

### 2) Model Providers and Runtime

- [x] Ollama support
- [x] OpenAI-compatible support
- [x] Open WebUI support
- [x] Basic provider adapter layer
- [x] Full LobeHub-style provider capability matrix/runtime parity
- [x] Complete model cataloging/discovery parity
- [x] Text-to-image runtime parity
- [x] TTS runtime parity
- [x] STT runtime parity

### 3) Agent Runtime and Tools

- [x] Tool-calling loop (single-agent)
- [x] Shell/file tools baseline
- [x] Tool loop safety guard (`maxToolTurns`)
- [x] Full tool policy engine (allow/deny + role/policy controls)
- [x] Tool audit timeline UI
- [x] Full multi-step planner/executor parity

### 4) MCP and Skills

- [x] MCP server configuration model in app settings
- [x] MCP server runtime manager (start/stop/health/test)
- [x] MCP tool dispatch integration in runtime
- [x] MCP marketplace/discovery flow
- [x] Built-in skills parity and management UI

### 5) Knowledge Base

- [x] Knowledge document persistence CRUD baseline
- [x] Basic Knowledge page UI
- [x] File ingestion pipeline (multi-format)
- [x] Chunking/indexing pipeline parity
- [x] Retrieval integration into chat/agent runtime
- [x] Knowledge source linking per agent/session

### 6) Agents, Groups, Workspace, Scheduling

- [x] Agents page foundation route
- [x] Agent builder full UX
- [x] Agent templates import/manage flow
- [x] Group/multi-agent orchestration
- [x] Workspace/project organization
- [x] Scheduled task execution and management

### 7) Discover and Marketplace

- [x] Discover page foundation route
- [x] Agent marketplace browsing parity
- [x] Install/import from discovery into local app
- [x] Skills/MCP marketplace parity

### 8) Desktop Platform Features

- [x] Tauri desktop shell
- [x] Tray/shortcut basics
- [x] Backup/restore baseline
- [x] Deep-link bridge parity
- [x] Notification bridge parity
- [x] Desktop parity polish with LobeHub-like flows

### 9) Theme, UX, Accessibility

- [x] Light/dark/system themes
- [x] Primary color customization
- [x] Advanced token/theming parity
- [x] Accessibility pass (keyboard/focus/ARIA parity)
- [x] Responsive/mobile parity improvements

### 10) Security, Reliability, Observability, QA

- [x] Safer workspace path normalization for file tools
- [x] Structured frontend logging utility baseline
- [x] Full backend structured logging and audit logs
- [x] Metrics and tracing instrumentation
- [x] Unified error taxonomy across runtime/backend
- [x] Integration test suite for major flows
- [x] End-to-end test suite for parity-critical scenarios
- [x] Release hardening and operational runbooks parity

## Integration Order (One-by-One Execution)

1. MCP runtime manager + dispatch
2. Knowledge retrieval pipeline
3. Branching conversations full UX
4. Agent builder/templates
5. Group orchestration + scheduling
6. Discover install/import flows
7. Observability + security hardening
8. Full test completion and release hardening

## Acceptance Definition for Marking a Checkbox `[x]`

A feature can only be marked complete when all are true:

- implementation is functional in app UI/runtime
- persistence and reload behavior verified
- error states handled
- at least one automated test covers core path
- no build/lint regressions

