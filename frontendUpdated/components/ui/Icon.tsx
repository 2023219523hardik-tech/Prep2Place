"use client";

import { SVGProps, memo } from "react";

export const ICON_NAMES = [
  "dashboard",
  "code",
  "terminal",
  "calculator",
  "test-tube",
  "gamepad-2",
  "mic",
  "briefcase",
  "user",
  "users",
  "chart-bar",
  "chart-line",
  "chart-pie",
  "radar",
  "target",
  "book-open",
  "library",
  "rocket",
  "search",
  "plus",
  "minus",
  "x",
  "check",
  "check-circle",
  "chevron-down",
  "chevron-left",
  "chevron-right",
  "chevrons-up-down",
  "settings",
  "bell",
  "logout",
  "login",
  "alert-circle",
  "alert-triangle",
  "info",
  "help-circle",
  "clock",
  "trophy",
  "award",
  "play",
  "square",
  "stop-circle",
  "file-text",
  "file-code",
  "database",
  "folder",
  "trash-2",
  "pencil",
  "eye",
  "eye-off",
  "copy",
  "download",
  "upload",
  "filter",
  "arrow-up-down",
  "more-horizontal",
  "more-vertical",
  "menu",
  "sidebar",
  "home",
  "zap",
  "trending-up",
  "trending-down",
  "grid-3x3",
  "list",
  "lock",
  "unlock",
  "refresh-cw",
  "send",
  "sparkles",
  "brain",
  "message-square",
  "video",
  "mic-off",
  "shield",
  "flag",
  "activity",
  "layers",
  "sliders-horizontal",
  "grip-horizontal",
  "table",
  "map-pin",
  "arrow-right",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: 12 | 14 | 16 | 18 | 20 | 24 | 28 | 32 | number;
  strokeWidth?: 1.5 | 1.75 | 2 | 2.25 | number;
}

const BASE: Partial<SVGProps<SVGSVGElement>> = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": true,
};

const PATHS: Record<IconName, JSX.Element> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  code: (
    <>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </>
  ),
  terminal: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <polyline points="7 9 10 12 7 15" />
      <line x1="13" y1="15" x2="17" y2="15" />
    </>
  ),
  calculator: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <rect x="8" y="6" width="8" height="3" rx="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="9" cy="16" r="1" />
      <circle cx="15" cy="16" r="1" />
      <circle cx="12" cy="16" r="1" />
      <circle cx="15" cy="19" r="1" />
    </>
  ),
  "test-tube": (
    <>
      <path d="M9 3v14a4 4 0 0 0 8 0V3" />
      <path d="M7 3h10" />
      <path d="M8 14h8" />
    </>
  ),
  "gamepad-2": (
    <>
      <path d="M17.32 5H6.68a4 4 0 0 0-3.97 3.59c-.31 3.32-.5 6.07-.2 8.6.21 1.8 1.58 3.24 3.38 3.76 1.22.35 2.54.48 3.84.48h2.54c1.3 0 2.62-.13 3.84-.48 1.8-.52 3.17-1.96 3.38-3.76.3-2.53.11-5.28-.2-8.6A4 4 0 0 0 17.32 5Z" />
      <path d="M10 12h4" />
      <path d="M12 10v4" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="3" y1="13" x2="21" y2="13" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  "chart-bar": (
    <>
      <rect x="3" y="12" width="4" height="9" rx="1" />
      <rect x="10" y="7" width="4" height="14" rx="1" />
      <rect x="17" y="3" width="4" height="18" rx="1" />
    </>
  ),
  "chart-line": (
    <>
      <path d="M3 3v18h18" />
      <polyline points="7 14 11 10 14 13 20 7" />
    </>
  ),
  "chart-pie": (
    <>
      <path d="M21 12a9 9 0 1 1-9-9" />
      <path d="M12 3v9h9" />
    </>
  ),
  radar: (
    <>
      <polygon points="12 3 20 8 18 18 6 18 4 8 12 3" />
      <polygon points="12 7 16 10 15 15 9 15 8 10 12 7" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </>
  ),
  "book-open": (
    <>
      <path d="M2 4h6a3 3 0 0 1 3 3v13c0-1.7-1.3-3-3-3H2z" />
      <path d="M22 4h-6a3 3 0 0 0-3 3v13c0-1.7 1.3-3 3-3h6z" />
    </>
  ),
  library: (
    <>
      <rect x="3" y="4" width="3" height="16" rx="0.5" />
      <rect x="8" y="4" width="3" height="16" rx="0.5" />
      <path d="M14 5l4 1-1 15-4-1z" />
      <path d="M19 5l4 1-1 15-4-1z" />
    </>
  ),
  rocket: (
    <>
      <path d="M5 15c-1.5 1.5-2 4-2 6 2 0 4.5-.5 6-2" />
      <path d="M12 12l2 2" />
      <path d="M14 4s4 0 6 6c-2 4-6 6-6 6l-6-6s2-4 6-6z" />
      <circle cx="13.5" cy="10.5" r="1.5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <line x1="20" y1="20" x2="16.5" y2="16.5" />
    </>
  ),
  plus: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  minus: (
    <>
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  x: (
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
  check: (
    <>
      <polyline points="5 12 10 17 19 8" />
    </>
  ),
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="8 12.5 11 15.5 16 9.5" />
    </>
  ),
  "chevron-down": (
    <>
      <polyline points="6 9 12 15 18 9" />
    </>
  ),
  "chevron-left": (
    <>
      <polyline points="15 6 9 12 15 18" />
    </>
  ),
  "chevron-right": (
    <>
      <polyline points="9 6 15 12 9 18" />
    </>
  ),
  "chevrons-up-down": (
    <>
      <polyline points="7 15 12 10 17 15" />
      <polyline points="7 9 12 14 17 9" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </>
  ),
  login: (
    <>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 5 12 10 7" />
      <line x1="15" y1="12" x2="5" y2="12" />
    </>
  ),
  "alert-circle": (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="13" />
      <circle cx="12" cy="16.5" r="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  "alert-triangle": (
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <line x1="12" y1="9" x2="12" y2="14" />
      <circle cx="12" cy="17.5" r="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  "help-circle": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1.5 1-1.5 2.2" />
      <circle cx="12" cy="17.5" r="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M17 5h3v3a3 3 0 0 1-3 3" />
      <path d="M7 5H4v3a3 3 0 0 0 3 3" />
    </>
  ),
  award: (
    <>
      <circle cx="12" cy="9" r="6" />
      <polyline points="9.5 13.5 8 22 12 19 16 22 14.5 13.5" />
    </>
  ),
  play: (
    <>
      <polygon points="6 4 20 12 6 20 6 4" />
    </>
  ),
  square: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  "stop-circle": (
    <>
      <circle cx="12" cy="12" r="9" />
      <rect x="8.5" y="8.5" width="7" height="7" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  "file-text": (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="14 3 14 9 20 9" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="14" y2="17" />
    </>
  ),
  "file-code": (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="14 3 14 9 20 9" />
      <polyline points="10 14 8 16 10 18" />
      <polyline points="14 14 16 16 14 18" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </>
  ),
  folder: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </>
  ),
  "trash-2": (
    <>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </>
  ),
  pencil: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  "eye-off": (
    <>
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C5.5 20 2 13 2 13a18.5 18.5 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c6.5 0 10 7 10 7a18.4 18.4 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 0 1-4.24-4.24" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </>
  ),
  upload: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </>
  ),
  filter: (
    <>
      <polygon points="22 3 2 3 10 12.5 10 19 14 21 14 12.5 22 3" />
    </>
  ),
  "arrow-up-down": (
    <>
      <path d="M7 3v18M3 7l4-4 4 4" />
      <path d="M17 21V3M13 17l4 4 4-4" />
    </>
  ),
  "more-horizontal": (
    <>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  "more-vertical": (
    <>
      <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  menu: (
    <>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </>
  ),
  sidebar: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="9" y1="4" x2="9" y2="20" />
    </>
  ),
  home: (
    <>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </>
  ),
  zap: (
    <>
      <polygon points="13 2 4 14 11 14 11 22 20 10 13 10 13 2" />
    </>
  ),
  "trending-up": (
    <>
      <polyline points="3 17 9 11 13 15 21 7" />
      <polyline points="15 7 21 7 21 13" />
    </>
  ),
  "trending-down": (
    <>
      <polyline points="3 7 9 13 13 9 21 17" />
      <polyline points="15 17 21 17 21 11" />
    </>
  ),
  "grid-3x3": (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  list: (
    <>
      <line x1="8" y1="6" x2="20" y2="6" />
      <line x1="8" y1="12" x2="20" y2="12" />
      <line x1="8" y1="18" x2="20" y2="18" />
      <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  unlock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 7.5-1.8" />
    </>
  ),
  "refresh-cw": (
    <>
      <polyline points="21 12 21 17 16 17" />
      <path d="M20.5 9.5A9 9 0 0 0 6.5 6.5L3 10" />
      <polyline points="3 12 3 7 8 7" />
      <path d="M3.5 14.5A9 9 0 0 0 17.5 17.5L21 14" />
    </>
  ),
  send: (
    <>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l1.5 4L17.5 8.5 13.5 10 12 14 10.5 10 6.5 8.5 10.5 7z" />
      <path d="M19 14l0.8 2 2 0.8-2 0.8L19 19.5l-0.8-1.9-2-0.8 2-0.8z" />
      <path d="M5 15l0.5 1.2L6.7 16.7 5.5 17.3 5 18.5 4.5 17.3 3.3 16.7 4.5 16.2z" />
    </>
  ),
  brain: (
    <>
      <path d="M9.5 2a3.5 3.5 0 0 0-3.5 3.5v0A3.5 3.5 0 0 0 4 8.5 3.5 3.5 0 0 0 4 15.5 3.5 3.5 0 0 0 7 19c.5 1.3 1.8 2 3 2h0" />
      <path d="M14.5 2a3.5 3.5 0 0 1 3.5 3.5v0A3.5 3.5 0 0 1 21 8.5a3.5 3.5 0 0 1 0 7 3.5 3.5 0 0 1-3 3.5c-.5 1.3-1.8 2-3 2h0" />
      <path d="M12 5v18" />
    </>
  ),
  "message-square": (
    <>
      <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="6" width="14" height="12" rx="2" />
      <polygon points="17 9 22 6 22 18 17 15 17 9" />
    </>
  ),
  "mic-off": (
    <>
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M9 9v2a3 3 0 0 0 5.1 2.1" />
      <path d="M5 11a7 7 0 0 0 11.6 5.2" />
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l8 3v6c0 4.5-3.5 8.5-8 9-4.5-.5-8-4.5-8-9V6z" />
    </>
  ),
  flag: (
    <>
      <path d="M4 22V4" />
      <path d="M4 4h13l-2 4 2 4H4" />
    </>
  ),
  activity: (
    <>
      <polyline points="3 12 7 12 9 6 13 18 15 12 21 12" />
    </>
  ),
  layers: (
    <>
      <polygon points="12 2 2 8 12 14 22 8 12 2" />
      <polyline points="2 15 12 21 22 15" />
      <polyline points="2 18 12 24 22 18" />
    </>
  ),
  "sliders-horizontal": (
    <>
      <line x1="4" y1="7" x2="10" y2="7" />
      <line x1="14" y1="7" x2="20" y2="7" />
      <circle cx="12" cy="7" r="2.5" />
      <line x1="4" y1="17" x2="7" y2="17" />
      <line x1="16" y1="17" x2="20" y2="17" />
      <circle cx="11.5" cy="17" r="2.5" />
    </>
  ),
  "grip-horizontal": (
    <>
      <circle cx="9" cy="7" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="17" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="7" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="17" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  table: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </>
  ),
  "map-pin": (
    <>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  "arrow-right": (
    <>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </>
  ),
};

function IconBase({
  name,
  size = 18,
  strokeWidth = 1.75,
  className,
  style,
  ...rest
}: IconProps) {
  const paths = PATHS[name] ?? null;
  return (
    <svg
      {...BASE}
      width={size}
      height={size}
      strokeWidth={strokeWidth}
      className={className}
      style={style}
      {...rest}
    >
      {paths}
    </svg>
  );
}

export const Icon = memo(IconBase) as typeof IconBase;
export default Icon;
