import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bot, BookOpen, Compass, MessageSquare, PenLine, Settings2 } from "./Icons";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface AppNavProps {
  onOpenSettings: () => void;
}

const NAV_ITEMS = [
  { to: "/chat", label: "Chat", Icon: MessageSquare },
  { to: "/agents", label: "Agents", Icon: Bot },
  { to: "/knowledge", label: "Knowledge", Icon: BookOpen },
  { to: "/discover", label: "Discover", Icon: Compass },
  { to: "/write", label: "Write", Icon: PenLine },
] as const;

export function AppNav({ onOpenSettings }: AppNavProps) {
  const location = useLocation();
  const [appVersion, setAppVersion] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !(window as unknown as { __TAURI__?: unknown }).__TAURI__) return;
    import("@tauri-apps/api/app")
      .then(({ getVersion }) => getVersion())
      .then(setAppVersion)
      .catch(() => {});
  }, []);

  const activeRoute =
    NAV_ITEMS.find(
      (item) =>
        location.pathname === item.to || location.pathname.startsWith(item.to + "/")
    )?.to ?? null;

  return (
    <TooltipProvider delayDuration={300}>
      <nav
        className="flex flex-col items-center w-14 shrink-0 border-r border-border bg-card py-3 gap-1"
        aria-label="Main navigation"
      >
        {/* Brand */}
        <Link
          to="/chat"
          className="flex items-center justify-center w-9 h-9 rounded-lg mb-2 hover:bg-accent transition-colors"
          aria-label="Cove home"
        >
          <img
            src={`${import.meta.env.BASE_URL}cove-logo-color.png`}
            alt="Cove"
            width={28}
            height={28}
            className="rounded-sm"
          />
        </Link>

        {appVersion && (
          <span className="text-[9px] text-muted-foreground mb-1 tabular-nums">
            {appVersion}
          </span>
        )}

        {/* Nav items */}
        <ul className="flex flex-col gap-1 flex-1 w-full px-1.5" role="list">
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <li key={to}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to={to}
                    className={cn(
                      "flex items-center justify-center w-full h-9 rounded-md transition-colors",
                      activeRoute === to
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                    aria-current={activeRoute === to ? "page" : undefined}
                    aria-label={label}
                  >
                    <Icon size={18} strokeWidth={activeRoute === to ? 2.5 : 2} aria-hidden />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs font-medium">
                  {label}
                </TooltipContent>
              </Tooltip>
            </li>
          ))}
        </ul>

        {/* Settings */}
        <div className="w-full px-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="flex items-center justify-center w-full h-9 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                onClick={onOpenSettings}
                aria-label="Open settings"
              >
                <Settings2 size={18} strokeWidth={2} aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs font-medium">
              Settings
            </TooltipContent>
          </Tooltip>
        </div>
      </nav>
    </TooltipProvider>
  );
}
