import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ChatPage from "./pages/ChatPage";

const HOME_PATHS = ["/", "/home"];

/** True when running inside the Tauri desktop app (.exe, .deb, etc.), false in browser. */
function isDesktopApp(): boolean {
  return typeof window !== "undefined" && !!window.__TAURI__ && !(window as Window & { __TAURI_MOCK__?: boolean }).__TAURI_MOCK__;
}

export default function App() {
  const location = useLocation();
  const isHome = HOME_PATHS.includes(location.pathname);
  const desktop = isDesktopApp();

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
      <Route path="/chat" element={<ChatPage />} />
      <Route path="*" element={<Navigate to={desktop ? "/chat" : "/"} replace />} />
    </Routes>
  );
}
