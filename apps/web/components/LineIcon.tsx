"use client";

export type IconName =
  | "folder"
  | "file"
  | "stack"
  | "edit"
  | "upload"
  | "play"
  | "check"
  | "x"
  | "menu"
  | "sigma"
  | "pen"
  | "chevron-down"
  | "graduation-cap"
  | "grid"
  | "chart"
  | "settings"
  | "sun"
  | "moon"
  | "users"
  | "sparkles"
  | "chat"
  | "send"
  | "camera";

export default function LineIcon({
  name,
  className = "h-5 w-5",
}: {
  name: IconName;
  className?: string;
}) {
  if (name === "sigma") {
    return <span className={`${className} grid place-items-center font-serif text-[1.05em] leading-none`}>Σ</span>;
  }

  const paths: Record<Exclude<IconName, "sigma">, React.ReactNode> = {
    folder: (
      <>
        <path d="M3.5 6.5h5l1.4 1.8h10.6v8.9a2.3 2.3 0 0 1-2.3 2.3H5.8a2.3 2.3 0 0 1-2.3-2.3V6.5Z" />
        <path d="M3.5 9.2h17" />
      </>
    ),
    file: (
      <>
        <path d="M7 3.5h7l3 3v14H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" />
        <path d="M14 3.5v4h4" />
        <path d="M8.5 12h7" />
        <path d="M8.5 15h5" />
      </>
    ),
    stack: (
      <>
        <path d="m12 3.5 8 4.2-8 4.2-8-4.2 8-4.2Z" />
        <path d="m4 12 8 4.2 8-4.2" />
        <path d="m4 16.2 8 4.3 8-4.3" />
      </>
    ),
    edit: (
      <>
        <path d="M4.5 19.5h15" />
        <path d="m6.5 15.5 1-4 7.8-7.8a1.8 1.8 0 0 1 2.6 0l.4.4a1.8 1.8 0 0 1 0 2.6l-7.8 7.8-4 1Z" />
        <path d="m13.8 5.2 3 3" />
      </>
    ),
    upload: (
      <>
        <path d="M12 15.5V4.5" />
        <path d="m7.5 9 4.5-4.5L16.5 9" />
        <path d="M5 16.5v1.8a2.2 2.2 0 0 0 2.2 2.2h9.6a2.2 2.2 0 0 0 2.2-2.2v-1.8" />
      </>
    ),
    play: <path d="M8 5.5v13l10-6.5-10-6.5Z" />,
    check: <path d="m5 12.5 4.2 4.2L19 6.8" />,
    x: (
      <>
        <path d="M6.5 6.5 17.5 17.5" />
        <path d="M17.5 6.5 6.5 17.5" />
      </>
    ),
    menu: (
      <>
        <path d="M5 7h14" />
        <path d="M5 12h14" />
        <path d="M5 17h14" />
      </>
    ),
    pen: (
      <>
        <path d="m5 19 4.3-1 9.2-9.2a2.1 2.1 0 0 0 0-3l-.3-.3a2.1 2.1 0 0 0-3 0L6 14.7 5 19Z" />
        <path d="m13.8 6.8 3.4 3.4" />
      </>
    ),
    "chevron-down": (
      <path d="m6 9 6 6 6-6" />
    ),
    "graduation-cap": (
      <>
        <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3Z" />
        <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82Z" />
      </>
    ),
    "grid": (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    "chart": (
      <>
        <path d="M3 3v18h18" />
        <path d="M18 9l-5 5-4-4-6 6" />
      </>
    ),
    "settings": (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </>
    ),
    "sun": (
      <>
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </>
    ),
    "moon": (
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    ),
    "users": (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    "sparkles": (
      <>
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        <path d="M5 3v4" />
        <path d="M3 5h4" />
        <path d="M19 17v4" />
        <path d="M17 19h4" />
      </>
    ),
    "chat": (
      <>
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l2.7-5.7A8.38 8.38 0 0 1 4.8 11.5a8.5 8.5 0 0 1 16.2 0Z" />
      </>
    ),
    "send": (
      <>
        <path d="M22 2 11 13" />
        <path d="M22 2l-7 20-4-9-9-4 20-7Z" />
      </>
    ),
    "camera": (
      <>
        <path d="M4 8h3.2l1.6-2.4h6.4L16.8 8H20a1.5 1.5 0 0 1 1.5 1.5V18a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18V9.5A1.5 1.5 0 0 1 4 8Z" />
        <circle cx="12" cy="13.5" r="3.4" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}
