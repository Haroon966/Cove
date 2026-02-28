# Contributing to Cove

Thanks for your interest in contributing. Here’s how to get started.

## Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/Haroon966/Cove.git
   cd Cove
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run locally**
   - **Browser:** `npm run dev` → open http://localhost:5173
   - **Desktop (requires Rust):** `npm run tauri dev`

## Making changes

- Create a branch, make your changes, and run `npm run build` (and `npm run tauri build` if you changed Rust).
- Run `npm run lint` before submitting.

## Submitting changes

- Open a **pull request** against `main` with a short description of what you changed.
- For bugs, open an **issue** first if you’d like to discuss; for small fixes you can send a PR directly.

## Code and behavior

- Keep the same style as the existing code (React + TypeScript in `src/`, Rust in `src-tauri/`).
- The app is fully local: no telemetry, no external APIs except the one the user configures (e.g. Ollama). Please don’t add tracking or non-configurable external calls.
