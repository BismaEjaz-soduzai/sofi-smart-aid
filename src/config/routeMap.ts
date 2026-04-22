/**
 * APP_ROUTE_MAP — single source of truth for AI voice navigation.
 * Every page, sub-section / tab the user can land on is listed here.
 * The intent recognizer injects this list into the AI prompt so the
 * model can map any natural phrase (English, Urdu, mixed) to a route.
 *
 * For sub-sections that live inside a page, we use query params the
 * destination page already understands (e.g. /assistant?section=chat,
 * /workspace?tab=pinboard, /workspace?tab=chat&room=AI).
 */

export type AppRouteEntry = {
  /** Path to navigate to (may include query params for tabs / sections). */
  route: string;
  /** Human-friendly destination name shown in UI ("Opening …"). */
  name: string;
  /** Keywords / synonyms (English + Urdu transliteration) for prompt grounding. */
  keywords: string[];
};

export const APP_ROUTE_MAP: AppRouteEntry[] = [
  // --- Top-level pages --------------------------------------------------
  {
    route: "/dashboard",
    name: "Dashboard",
    keywords: ["dashboard", "home", "main", "overview", "ghar", "main page", "shuru"],
  },
  {
    route: "/organizer",
    name: "Organizer",
    keywords: ["organizer", "tasks and notes", "kaam"],
  },
  {
    route: "/organizer",
    name: "My Tasks",
    keywords: ["tasks", "todo", "to do", "my tasks", "kaam", "kaam ki list"],
  },
  {
    route: "/organizer",
    name: "My Notes",
    keywords: ["notes", "my notes", "notebook", "notes kholo", "likha hwa"],
  },
  {
    route: "/planner",
    name: "Study Planner",
    keywords: ["planner", "study planner", "calendar", "schedule", "plans", "active plans", "plan"],
  },
  {
    route: "/workspace",
    name: "Smart Workspace",
    keywords: ["smart workspace", "workspace", "study room", "fyp room", "study area", "kamra"],
  },
  {
    route: "/assistant",
    name: "SOFI Assistant",
    keywords: ["assistant", "sofi", "ai assistant", "sophia", "helper"],
  },
  {
    route: "/chat",
    name: "Chat Rooms",
    keywords: ["chat", "chats", "messages", "rooms", "chat rooms", "baat cheet", "guftugu"],
  },
  {
    route: "/analytics",
    name: "Study Analytics",
    keywords: ["analytics", "stats", "progress", "performance", "report", "data", "raporr"],
  },
  {
    route: "/profile",
    name: "Profile",
    keywords: ["profile", "my profile", "account", "me", "mera profile"],
  },
  {
    route: "/settings",
    name: "Settings",
    keywords: ["settings", "preferences", "config", "options", "setting"],
  },

  // --- Smart Workspace tabs --------------------------------------------
  {
    route: "/workspace?tab=uploads",
    name: "Workspace · Uploads",
    keywords: ["uploads", "files", "documents", "my files", "upload", "file dikhao"],
  },
  {
    route: "/workspace?tab=ai-tools",
    name: "Workspace · AI Tools",
    keywords: ["ai tools", "tools", "study tools", "ai", "summarize", "explain", "quiz"],
  },
  {
    route: "/workspace?tab=generated",
    name: "Workspace · Generated",
    keywords: ["generated", "ai output", "results", "generated content"],
  },
  {
    route: "/workspace?tab=recordings",
    name: "Workspace · Recordings",
    keywords: ["recordings", "recording", "videos", "lectures", "recording dikhao", "ریکارڈنگ"],
  },
  {
    route: "/workspace?tab=pinboard",
    name: "Workspace · Pinboard",
    keywords: ["pinboard", "pin board", "links", "saved links", "bookmarks", "pinned"],
  },
  {
    route: "/workspace?tab=chat",
    name: "Workspace · Room Chat",
    keywords: ["room chat", "workspace chat", "study room chat"],
  },

  // --- Study rooms (deep links by name) --------------------------------
  {
    route: "/workspace?room=FYP",
    name: "FYP Room",
    keywords: ["fyp", "fyp room", "final year project", "project room"],
  },
  {
    route: "/workspace?room=AI",
    name: "AI Room",
    keywords: ["ai room", "artificial intelligence room", "ai study room"],
  },
  {
    route: "/workspace?tab=uploads&filter=fyp-notes",
    name: "FYP Notes",
    keywords: ["fyp notes", "final year notes", "project notes"],
  },

  // --- SOFI Assistant sections -----------------------------------------
  {
    route: "/assistant?section=chat",
    name: "SOFI · Chat",
    keywords: ["sofi chat", "ai chat", "chat with sofi", "ask sofi"],
  },
  {
    route: "/assistant?section=voice",
    name: "SOFI · Voice Mode",
    keywords: ["voice mode", "voice", "talk to sofi", "voice assistant", "awaz"],
  },
  {
    route: "/assistant?section=focus",
    name: "SOFI · Focus Timer",
    keywords: ["focus", "focus mode", "pomodoro", "timer", "focus timer", "study timer"],
  },
  {
    route: "/assistant?section=tools",
    name: "SOFI · AI Tools",
    keywords: ["sofi tools", "assistant tools", "ai tools", "quick tools"],
  },
  {
    route: "/assistant?prompt=motivation",
    name: "Motivation Boost",
    keywords: ["motivation", "motivate me", "inspire", "boost", "encourage", "himmat"],
  },
  {
    route: "/assistant?prompt=mood",
    name: "Mood Tracker",
    keywords: ["mood", "mood tracker", "feelings", "how am i feeling", "mizaj"],
  },
];
