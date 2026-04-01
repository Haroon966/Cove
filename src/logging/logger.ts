type Level = "debug" | "info" | "warn" | "error";

function write(level: Level, message: string, meta?: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(meta ? { meta } : {}),
  };
  const text = JSON.stringify(payload);
  if (level === "error") {
    console.error(text);
  } else if (level === "warn") {
    console.warn(text);
  } else {
    console.log(text);
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => write("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => write("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write("error", message, meta),
};

