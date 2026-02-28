import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { installTauriMock } from "./tauri-mock";
import App from "./App";
import "./App.css";

installTauriMock();

const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
if (favicon) favicon.href = `${import.meta.env.BASE_URL}cove-logo-color.png`;

const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={basename || "/"}>
      <App />
    </BrowserRouter>
  </StrictMode>
);
