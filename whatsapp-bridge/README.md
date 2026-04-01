# Cove WhatsApp Bridge

Links your WhatsApp (via QR code, like WhatsApp Web) so incoming messages are answered by your Cove AI (Ollama or OpenAI-compatible).

**Unofficial.** For personal use only. WhatsApp's ToS may restrict automation.

Requires Node.js 18+ and Chrome/Chromium (used by whatsapp-web.js via Puppeteer).

## Setup

1. Install dependencies (once):

   ```bash
   cd whatsapp-bridge && npm install
   ```

   If install fails because Puppeteer cannot download Chrome (e.g. "Failed to set up chrome"), use your system Chromium instead:

   ```bash
   cd whatsapp-bridge
   PUPPETEER_SKIP_DOWNLOAD=1 npm install
   ```

   Then install Chromium if needed: `sudo apt install chromium-browser` (Debian/Ubuntu). The bridge uses `chromium` on Linux by default when the bundled Chrome is not present. To use another browser, set `PUPPETEER_EXECUTABLE_PATH=/path/to/chrome` when running the bridge.

2. From Cove desktop: open **Settings** → **WhatsApp** → **Connect WhatsApp**. The app will start the bridge and show the QR code. Scan it with WhatsApp → Linked devices.

Or run manually:

```bash
node index.js --config=/path/to/whatsapp-ai-config.json [--session-dir=/path] [--port=3456]
```

Config path in desktop app: use the path shown in Settings → WhatsApp (or run from Cove project root so the app can start the bridge for you).

## How it works

- The bridge runs a small HTTP server on `http://127.0.0.1:3456` (or `--port`).
- **GET /qr** or **GET /qr.json** – QR code to link WhatsApp (until linked).
- **GET /status** – `{ "linked": true }` when WhatsApp is connected.
- Incoming direct messages are sent to your configured AI (Ollama/OpenAI); the reply is sent back on WhatsApp. Config is re-read on each message so you can change model/API in Cove Settings without restarting the bridge.

Session is stored in `--session-dir` (or `.wwebjs_auth` in the bridge directory) so you usually only scan the QR once.
