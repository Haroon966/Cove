import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ChatPage from "./pages/ChatPage";
import OpenWebUIFullPage from "./pages/OpenWebUIFullPage";
import AgentsPage from "./pages/AgentsPage";
import KnowledgePage from "./pages/KnowledgePage";
import DiscoverPage from "./pages/DiscoverPage";
import DocWriterPage from "./pages/DocWriterPage";
import AppLayout from "./components/AppLayout";
import { consumePendingDeepLinks, parseDeepLinkUrl } from "./desktop/deepLink";
import { addBackendAuditLog } from "./features/logging/backendAuditLog";

const HOME_PATHS = ["/", "/home"];

/** True when running inside the Tauri desktop app (.exe, .deb, etc.), false in browser. */
function isDesktopApp(): boolean {
  return typeof window !== "undefined" && !!window.__TAURI__ && !(window as Window & { __TAURI_MOCK__?: boolean }).__TAURI_MOCK__;
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = HOME_PATHS.includes(location.pathname);
  const desktop = isDesktopApp();

  useEffect(() => {
    if (!desktop) return;

    const applyDeepLink = (url: string) => {
      const parsed = parseDeepLinkUrl(url);
      if (!parsed) return;
      const query = parsed.query ? new URLSearchParams(parsed.query).toString() : "";
      void addBackendAuditLog("info", "deep_link_applied", { url, route: parsed.route, query: parsed.query ?? null });
      navigate(query ? `${parsed.route}?${query}` : parsed.route);
    };

    let unlisten: (() => void) | null = null;
    consumePendingDeepLinks().then((urls) => urls.forEach(applyDeepLink)).catch(() => {});
    import("@tauri-apps/api/event")
      .then(async ({ listen }) => {
        unlisten = await listen<string>("cove://deep-link", (event) => {
          if (typeof event.payload === "string") applyDeepLink(event.payload);
        });
      })
      .catch(() => {});
    return () => {
      if (unlisten) unlisten();
    };
  }, [desktop, navigate]);

  useEffect(() => {
    if (isHome) {
      document.body.classList.add("home-route");
    } else {
      document.body.classList.remove("home-route");
    }
    return () => document.body.classList.remove("home-route");
  }, [isHome]);

  return (
    <Routes>
      <Route
        path="/"
        element={desktop ? <Navigate to="/chat" replace /> : <HomePage />}
      />
      <Route
        path="/home"
        element={desktop ? <Navigate to="/chat" replace /> : <HomePage />}
      />
      <Route element={<AppLayout />}>
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/write" element={<DocWriterPage />} />
        <Route path="/open-webui" element={<ChatPage forceBackendType="open_webui" />} />
      </Route>
      <Route path="/open-webui/full" element={<OpenWebUIFullPage />} />
      <Route path="*" element={<Navigate to={desktop ? "/chat" : "/"} replace />} />
    </Routes>
  );
}
