# Open WebUI Integration Reference

This project integrates Open WebUI capabilities into Cove while keeping Cove's existing Tauri + React architecture.

## Reference Clone

- Source repository: `https://github.com/open-webui/open-webui`
- Local reference path: `/home/olufsen/open-webui`
- Pinned upstream commit: `9bd84258d09eefe7bf975878fb0e31a5dadfe0f8`

## Feature Parity Matrix

| Feature Area | Open WebUI Capability | Cove Integration Strategy | Status |
| --- | --- | --- | --- |
| Provider routing | Unified provider UX with OpenAI-compatible APIs | Add dedicated `open_webui` backend type + API adapter | Implemented |
| Model discovery | List models from Open WebUI endpoints | Fallback probing on `/api/models` and `/v1/models` | Implemented |
| Streaming chat | SSE-based completion streaming | Open WebUI adapter with chat endpoint fallback | Implemented |
| Tool calling | Function/tool call loop | Reuse Cove agent loop with Open WebUI streaming parser compatibility | Implemented |
| Session persistence | Conversation state and metadata | Extend session metadata for Open WebUI workspace/thread ids | Implemented |
| Config management | Endpoint/auth/runtime controls | Extend app config in frontend + Tauri + browser mock | Implemented |
| UX entry point | Product-facing Open WebUI experience | Add dedicated route and Open WebUI benefits section | Implemented |
| Production readiness | Deployment and operations guidance | Add runbook and verification checklist to README + this doc | Implemented |

## Production Validation Checklist

- [x] Open WebUI backend selectable from Settings
- [x] Open WebUI model list loads with endpoint fallbacks
- [x] Open WebUI streaming chat works in standard mode
- [x] Open WebUI streaming tool calls work in agent mode
- [x] Config persists in desktop (SQLite `app_config`) and browser fallback (`localStorage`)
- [x] Session schema supports Open WebUI metadata fields
- [x] Dedicated product section explains Open WebUI advantages
- [x] Route-level Open WebUI entry point is available
