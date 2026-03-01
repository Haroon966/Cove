import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ChatPage from "./pages/ChatPage";

const HOME_PATHS = ["/", "/home"];

export default function App() {
  const location = useLocation();
  const isHome = HOME_PATHS.includes(location.pathname);

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
      <Route path="/" element={<HomePage />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/chat" element={<ChatPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
