# Cove

A fully local, cross-platform desktop app to chat with locally installed AI (Ollama or any OpenAI-compatible API). Sessions are stored in SQLite on your machine. No CDN or online requests; plain CSS only.

## Features

- **Chat UI** – Streaming replies (tokens appear as they arrive)
- **Ollama & OpenAI-compatible** – Works with Ollama, LocalAI, LM Studio, etc. Configurable base URL and model
- **Session persistence** – Conversations saved in SQLite, resumable after restart
- **Plain CSS** – No Tailwind or UI libraries; system fonts, no external assets
- **Theming** – Light, dark, or system; optional primary color
- **Search** – Find text across sessions and messages
- **Cross-platform** – One codebase for Windows (.exe), Ubuntu (.deb / AppImage), and macOS (.dmg)

## Prerequisites

- **Node.js** (v18+) and npm
- **Rust** (for building the Tauri app): [rustup](https://rustup.rs/)
- **Platform deps** (see [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/)):
  - **Ubuntu**: `sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`
  - **Windows**: Visual Studio Build Tools with C++ and the WebView2 runtime
  - **macOS**: Xcode Command Line Tools

## Development

### Option A: Browser (no Rust)

Run the frontend and test UI and streaming against your local AI:

```bash
npm install
npm run dev
```

Open **http://localhost:5173**. A mock layer stores config and sessions in `localStorage`. In **Settings**, set the base URL (e.g. `http://localhost:11434` for Ollama), choose a model, and ensure Ollama or your OpenAI-compatible server is running.

### Option B: Desktop app (Rust required)

```bash
npm install
npm run tauri dev
```

This starts the Vite dev server and opens the Tauri window. Configure **Settings** (backend type, base URL, model) and ensure Ollama or your API is running (e.g. `http://localhost:11434` for Ollama).

## Build (production)

```bash
npm run build
npm run tauri build
```

Artifacts:

| Platform | Output |
|----------|--------|
| Windows | `src-tauri/target/release/bundle/nsis/Cove_0.1.0_x64-setup.exe` (or `.msi`) |
| Ubuntu | `src-tauri/target/release/bundle/deb/*.deb` or `appimage/*.AppImage` |
| macOS | `src-tauri/target/release/bundle/dmg/*.dmg` (must build on macOS) |

For CI or non-interactive builds, set `CI=true` in the environment so the build skips prompts.

## Project layout

| Path | Description |
|------|-------------|
| `src/` | React + TypeScript frontend (Vite) |
| `src/App.tsx`, `App.css` | Main layout, plain CSS |
| `src/components/` | ChatPanel, SessionList, Settings |
| `src/api/` | `ollama.ts`, `openai.ts` – streaming chat (requests only to configured URL) |
| `src/hooks/useStreamingChat.ts` | Streaming state and send |
| `src-tauri/` | Tauri 2 Rust app |
| `src-tauri/src/lib.rs` | Command registration |
| `src-tauri/src/db.rs` | SQLite sessions and messages |
| `src-tauri/src/config.rs` | App config in app data dir |

## Data and config

- **Database**: SQLite in the Tauri app data directory (e.g. `~/.local/share/app.cove/cove.db` on Linux).
- **Config**: `config.json` in the same directory (backend type, base URL, model, optional API key).

All network requests go only to the base URL set in Settings. No telemetry or external APIs.
# Cove
