<div align="center">
  <table style="margin: 0 auto;">
    <tr>
      <td width="100" valign="middle"><img src="public/cove-logo-color.png" width="96" height="96" alt="Cove" /></td>
      <td valign="middle" style="padding-left: 16px; text-align: left;">
        <div style="font-size: 3.5em; font-weight: 700; line-height: 1.2;">Cove</div>
        <div style="font-size: 1.25em; color: #64748b;">Your Private Corner.</div>
      </td>
    </tr>
  </table>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-GPL--3.0-blue.svg" alt="License: GPL-3.0" /></a>
</div>

A fully local, cross-platform desktop app that talks to Ollama, Open WebUI, or any OpenAI-compatible API. Sessions live in SQLite on your machine—no CDN, no tracking, plain CSS.

---

## ✨ What you get

|                            |                                                                        |
| -------------------------- | ---------------------------------------------------------------------- |
| **💬 Streaming chat**      | Tokens appear as they arrive.                                          |
| **🔌 Ollama & compatible** | Works with Ollama, LocalAI, LM Studio—configurable base URL and model. |
| **🧩 Open WebUI mode**     | Dedicated route + endpoint adapter for Open WebUI deployments.           |
| **💾 Sessions saved**      | Conversations in SQLite; resume anytime after restart.                 |
| **🎨 Theming**             | Light, dark, or system; optional primary color.                        |
| **🔍 Search**              | Find text across sessions and messages.                                |
| **📦 Cross-platform**      | Windows (.exe), Ubuntu (.deb / AppImage), macOS (.dmg).                |

---

## 🚀 Quick start

**Browser (no Rust):**

```bash
npm install && npm run dev
```

Open **http://localhost:5173** → **Settings** → set base URL (e.g. `http://localhost:11434` for Ollama) and model.

**Open WebUI mode (browser or desktop):**

1. Start Open WebUI (default: `http://127.0.0.1:8080`).
2. Open Cove and go to `/open-webui` route.
3. In **Settings**, select **Open WebUI** provider.
4. Set model and optional API key.
5. Chat normally (streaming + agent tool calls are supported).

**Open WebUI full console route:**

- Visit `/open-webui/full` to load the complete Open WebUI interface inside Cove.
- Point it to your running Open WebUI server URL (default `http://127.0.0.1:8080`).
- This route exposes the full Open WebUI feature surface (RAG/library/admin/plugins/etc.) provided by your Open WebUI deployment.

**Desktop app (Rust required):**

```bash
npm install && npm run tauri dev
```

Same flow: configure **Settings** and point to your API.

---

## 📋 Prerequisites

- **Node.js** v18+ and npm
- **Rust** — [rustup](https://rustup.rs/) (for desktop build only)
- **Platform** — [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/):
  - **Ubuntu:** `sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`
  - **Windows:** Visual Studio Build Tools (C++) + WebView2
  - **macOS:** Xcode Command Line Tools

---

## 📦 Build (production)

```bash
npm run build
npm run tauri build
```

| Platform | Output                                                                      |
| -------- | --------------------------------------------------------------------------- |
| Windows  | `src-tauri/target/release/bundle/nsis/Cove_0.1.0_x64-setup.exe` (or `.msi`) |
| Ubuntu   | `src-tauri/target/release/bundle/deb/*.deb` or `appimage/*.AppImage`        |
| macOS    | `src-tauri/target/release/bundle/dmg/*.dmg` _(build on macOS)_              |

> **Tip:** Set `CI=true` for non-interactive builds.

---

## 📁 Project layout

| Path                            | Description                               |
| ------------------------------- | ----------------------------------------- |
| `src/`                          | React + TypeScript frontend (Vite)        |
| `src/App.tsx`, `App.css`        | Main layout, plain CSS                    |
| `src/components/`               | ChatPanel, SessionList, Settings          |
| `src/api/`                      | `ollama.ts`, `openai.ts`, `openwebui.ts` — provider adapters |
| `src/hooks/useStreamingChat.ts` | Streaming state and send                  |
| `src-tauri/`                    | Tauri 2 Rust app                          |
| `src-tauri/src/lib.rs`          | Command registration                      |
| `src-tauri/src/db.rs`           | SQLite sessions and messages              |
| `src-tauri/src/config.rs`       | Config repository + migration logic        |

---

## 🌐 Deploy to GitHub Pages

The app is set up for GitHub Pages. Push to `main` and enable **Settings → Pages → Build and deployment → Source: GitHub Actions**. The site will be at `https://Haroon966.github.io/Cove/` (or your repo name).

To build locally for the same base path:

```bash
VITE_BASE_PATH=/Cove/ npm run build
```

Then serve the `dist/` folder under the `/Cove/` path.

---

## 🔐 Data & config

- **Database:** SQLite in the app data directory (e.g. `~/.local/share/app.cove/cove.db` on Linux).
- **Config:** Stored in SQLite (`app_config` table) in the same database.
- **Legacy migration:** Older installs with `config.json` are auto-migrated on first launch, then SQLite becomes source of truth.

All requests go only to the base URL you set in Settings. **No telemetry or external APIs.**

### Persistence Rollout Notes

- Before upgrading production machines, take a local backup from Settings and keep a copy of the app data directory.
- If migration fails or data appears inconsistent, restore from backup and follow the runbook in [`docs/persistence-runbook.md`](docs/persistence-runbook.md).
- Browser/dev mode still uses local fallback storage for UI-only testing parity.

---

## Open WebUI Production Notes

- Keep Open WebUI and Cove on trusted internal hosts.
- For web deployment, allow your Cove origin in Open WebUI CORS settings.
- Use provider-scoped API keys in Settings (`open_webui`, `openai`, `groq`, etc.).
- Persist backups before schema upgrades (`Backup all data` from Settings).
- Keep the Open WebUI reference commit pinned in [`docs/open-webui-integration.md`](docs/open-webui-integration.md).

### Verification Checklist

Run before release:

```bash
npm run build
npm run tauri build
```

Then verify:

- Open WebUI provider can fetch models.
- Standard chat streams in `/open-webui`.
- Agent mode tool-calls complete without parser errors.
- Settings persist after restart (desktop) and reload (web).
- Backup/restore roundtrip preserves tool-call metadata.

---

## License

This project is licensed under **GPL-3.0**. You may use and modify it. If you distribute it (or a modified version), you must give credit, indicate that you modified it (e.g. in your README or app), and link to this repository: **https://github.com/Haroon966/Cove**.
