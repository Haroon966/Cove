#!/usr/bin/env node
/**
 * Cove WhatsApp bridge: link WhatsApp via QR, reply to messages with AI (Ollama/OpenAI).
 * Usage: node index.js --config=/path/to/whatsapp-ai-config.json [--session-dir=/path] [--port=3456]
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import express from "express";
import QRCode from "qrcode";
import { loadConfig } from "./config.js";
import { chatCompletion } from "./ai.js";

const { Client, LocalAuth } = require("whatsapp-web.js");

function parseArgs() {
  const args = process.argv.slice(2);
  let configPath = null;
  let sessionDir = null;
  let port = parseInt(process.env.WHATSAPP_BRIDGE_PORT || "3456", 10);
  for (const arg of args) {
    if (arg.startsWith("--config=")) configPath = arg.slice("--config=".length);
    else if (arg.startsWith("--session-dir=")) sessionDir = arg.slice("--session-dir=".length);
    else if (arg.startsWith("--port=")) port = parseInt(arg.slice("--port=".length), 10);
  }
  return { configPath, sessionDir, port };
}

const { configPath, sessionDir, port } = parseArgs();
if (!configPath) {
  console.error("Usage: node index.js --config=/path/to/whatsapp-ai-config.json [--session-dir=/path] [--port=3456]");
  process.exit(1);
}

let currentQr = null;
let linked = false;

const authOptions = { clientId: "cove-bridge" };
if (sessionDir) authOptions.dataPath = sessionDir;

const puppeteerOpts = {
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
};
if (process.env.PUPPETEER_EXECUTABLE_PATH) {
  puppeteerOpts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
} else if (process.platform === "linux") {
  puppeteerOpts.executablePath = "chromium";
}

const client = new Client({
  authStrategy: new LocalAuth(authOptions),
  puppeteer: puppeteerOpts,
});

client.on("qr", async (qr) => {
  linked = false;
  try {
    currentQr = await QRCode.toDataURL(qr, { width: 280, margin: 1 });
  } catch (e) {
    currentQr = null;
    console.error("QR encode error:", e);
  }
});

client.on("ready", () => {
  linked = true;
  currentQr = null;
  console.log("WhatsApp client ready.");
});

client.on("authenticated", () => {
  console.log("WhatsApp authenticated.");
});

client.on("auth_failure", (msg) => {
  console.error("WhatsApp auth failure:", msg);
});

client.on("message", async (msg) => {
  const body = msg.body?.trim();
  if (!body) return;
  const chat = await msg.getChat();
  if (chat.isGroup) return;

  let config;
  try {
    config = loadConfig(configPath);
  } catch (e) {
    console.error("Config load error:", e.message);
    await msg.reply("Cove bridge: Could not load AI config. Check Settings.");
    return;
  }

  try {
    const reply = await chatCompletion(config, body);
    await msg.reply(reply);
  } catch (e) {
    console.error("AI error:", e.message);
    await msg.reply("Cove bridge: " + (e.message || "AI error."));
  }
});

const app = express();
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

app.get("/qr", async (req, res) => {
  if (linked) {
    res.status(204).end();
    return;
  }
  if (currentQr) {
    const base64 = currentQr.replace(/^data:image\/png;base64,/, "");
    const buf = Buffer.from(base64, "base64");
    res.setHeader("Content-Type", "image/png");
    res.send(buf);
    return;
  }
  res.status(404).json({ error: "No QR yet" });
});

app.get("/qr.json", (req, res) => {
  if (linked) {
    res.status(204).end();
    return;
  }
  if (currentQr) {
    res.json({ qr: currentQr });
    return;
  }
  res.status(404).json({ error: "No QR yet" });
});

app.get("/status", (req, res) => {
  res.json({ linked });
});

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Cove WhatsApp Bridge</title></head>
<body style="font-family:sans-serif;max-width:400px;margin:2rem auto;text-align:center">
  <h1>Cove WhatsApp Bridge</h1>
  <p id="status">${linked ? "Connected" : "Scan the QR code with WhatsApp (Linked Devices)."}</p>
  <div id="qr" style="margin:1rem 0">${currentQr ? `<img src="${currentQr}" alt="QR code" width="280" height="280"/>` : "<p>Loading QR…</p>"}</div>
  <p style="color:#666;font-size:0.9rem">Unofficial; for personal use. WhatsApp ToS may restrict automation.</p>
  <script>
    setInterval(async () => {
      const r = await fetch('/status');
      const d = await r.json();
      if (d.linked) { document.getElementById('status').textContent = 'Connected'; document.getElementById('qr').innerHTML = ''; return; }
      const q = await fetch('/qr.json');
      if (q.ok) { const j = await q.json(); document.getElementById('qr').innerHTML = '<img src="'+j.qr+'" alt="QR" width="280" height="280"/>'; }
    }, 2000);
  </script>
</body>
</html>`);
});

client.initialize().catch((e) => {
  console.error("WhatsApp client init error:", e);
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Bridge HTTP server at http://127.0.0.1:${port}`);
});
