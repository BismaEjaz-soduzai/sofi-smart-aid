const TIMEZONE_KEY = "sofi-timezone";
const TIME_FORMAT_KEY = "sofi-time-format";

function readLocalStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function getUserTimeZone() {
  return readLocalStorage(TIMEZONE_KEY) || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function isUser12Hour() {
  return (readLocalStorage(TIME_FORMAT_KEY) || "12h") === "12h";
}

export function formatUserClock(value: Date | string | number) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: isUser12Hour(),
    timeZone: getUserTimeZone(),
  }).format(date);
}

export function formatUserDateTime(value: Date | string | number) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: isUser12Hour(),
    timeZone: getUserTimeZone(),
  }).format(date);
}