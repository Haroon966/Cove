import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installTauriMock } from "./tauri-mock";
import App from "./App";
import "./App.css";

installTauriMock();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
