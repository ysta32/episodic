import type { ReactElement, SVGProps } from "react";

/**
 * Kinescope icon set: 24px grid, 1.75 stroke, round caps/joins, currentColor.
 * Hand-drawn for Episodic; slate-like geometry, no filled blobs (except star fills).
 */
const paths = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  "check-double": (
    <>
      <path d="M2.5 12.5l4 4L15 8" />
      <path d="M11.5 16.5l1 0.5L21.5 8" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
    </>
  ),
  play: <path d="M8 5.5v13l10.5-6.5z" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="M8 14h2M14 14h2M8 17h2" />
    </>
  ),
  queue: (
    <>
      <path d="M4 6h11M4 11h11M4 16h7" />
      <path d="M16 14.5v6l4.5-3z" />
    </>
  ),
  library: (
    <>
      <rect x="3.5" y="4" width="4" height="16" rx="1" />
      <rect x="9.5" y="4" width="4" height="16" rx="1" />
      <path d="M15.6 5.2l3.8-1 3 15.4-3.8 1z" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.75" />
      <path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  star: (
    <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />
  ),
  "star-filled": (
    <path
      d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"
      fill="currentColor"
    />
  ),
  "star-half": (
    <>
      <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />
      <path d="M12 3.5v13.3l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" fill="currentColor" />
    </>
  ),
  spoiler: (
    <>
      <path d="M3 12s3.2-6 9-6c1.7 0 3.1.5 4.3 1.2M21 12s-3.2 6-9 6c-1.7 0-3.1-.5-4.3-1.2" />
      <path d="M9.6 14.4a3.4 3.4 0 014.8-4.8" />
      <path d="M4 20L20 4" />
    </>
  ),
  eye: (
    <>
      <path d="M3 12s3.2-6 9-6 9 6 9 6-3.2 6-9 6-9-6-9-6z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  pulse: <path d="M3 13h3.5l2-5 3 10 2.5-7 1.5 2H21" />,
  rewind: (
    <>
      <path d="M4.5 12a7.5 7.5 0 107.5-7.5c-2.4 0-4.4 1.1-5.8 2.8" />
      <path d="M5.5 3.5v4h4" />
      <path d="M12 8.5V12l2.5 2" />
    </>
  ),
  import: (
    <>
      <path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5" />
      <path d="M4 15.5v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
    </>
  ),
  export: (
    <>
      <path d="M12 14.5v-11M7.5 8L12 3.5 16.5 8" />
      <path d="M4 15.5v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
    </>
  ),
  undo: (
    <>
      <path d="M8.5 5L4 9.5 8.5 14" />
      <path d="M4 9.5h10a5.5 5.5 0 010 11h-3" />
    </>
  ),
  "chevron-left": <path d="M14.5 6l-6 6 6 6" />,
  "chevron-right": <path d="M9.5 6l6 6-6 6" />,
  "chevron-down": <path d="M6 9.5l6 6 6-6" />,
  more: (
    <>
      <circle cx="5.5" cy="12" r="0.9" fill="currentColor" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" />
      <circle cx="18.5" cy="12" r="0.9" fill="currentColor" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4.5M12 17.25v.25" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.75V8" />
    </>
  ),
  offline: (
    <>
      <path d="M2.5 9.5a14 14 0 0114.2-3M21.5 9.5a14 14 0 00-2-1.5" />
      <path d="M5.5 12.8a9.5 9.5 0 017.2-2.6M18.5 12.8a9.5 9.5 0 00-1.3-1" />
      <path d="M9 16a4.5 4.5 0 016 0" />
      <path d="M12 19.5v.01" />
      <path d="M3.5 3.5l17 17" />
    </>
  ),
  command: (
    <path d="M9 9V6.5A2.5 2.5 0 106.5 9H9zm0 0h6m-6 0v6m6-6V6.5A2.5 2.5 0 1117.5 9H15zm0 0v6m0 0h-6m6 0v2.5a2.5 2.5 0 102.5-2.5H15zm-6 0v2.5A2.5 2.5 0 116.5 15H9z" />
  ),
  filter: <path d="M4 5.5h16l-6.2 7.3V19l-3.6-1.8v-4.4z" />,
  list: (
    <>
      <path d="M9 6.5h11M9 12h11M9 17.5h11" />
      <path d="M4 6.5h1.5M4 12h1.5M4 17.5h1.5" />
    </>
  ),
  trash: (
    <>
      <path d="M4 6.5h16M9.5 6.5V4.5h5v2" />
      <path d="M6 6.5l1 13.5h10l1-13.5" />
      <path d="M10 10.5v6M14 10.5v6" />
    </>
  ),
  external: (
    <>
      <path d="M13.5 4.5h6v6M19.5 4.5L11 13" />
      <path d="M17.5 14v4.5a1.5 1.5 0 01-1.5 1.5H6a1.5 1.5 0 01-1.5-1.5V8.5A1.5 1.5 0 016 7h4.5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  moon: <path d="M19.5 14.5A8 8 0 019.5 4.5a8 8 0 1010 10z" />,
  grip: (
    <>
      <circle cx="9" cy="6" r="0.9" fill="currentColor" />
      <circle cx="15" cy="6" r="0.9" fill="currentColor" />
      <circle cx="9" cy="12" r="0.9" fill="currentColor" />
      <circle cx="15" cy="12" r="0.9" fill="currentColor" />
      <circle cx="9" cy="18" r="0.9" fill="currentColor" />
      <circle cx="15" cy="18" r="0.9" fill="currentColor" />
    </>
  ),
  slate: (
    <>
      <rect x="3.5" y="9" width="17" height="11" rx="1.5" />
      <path d="M3.5 9l1.2-4.6 16 3.6" />
      <path d="M8.5 5.6L7.6 9M13.5 6.7L12.6 9" />
    </>
  ),
  tv: (
    <>
      <rect x="3" y="6.5" width="18" height="12.5" rx="2" />
      <path d="M8.5 2.5l3.5 4 3.5-4M8 21.5h8" />
    </>
  ),
} satisfies Record<string, ReactElement>;

export type IconName = keyof typeof paths;
export const iconNames = Object.keys(paths) as IconName[];

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
  /** Accessible label. Omit for decorative icons (default aria-hidden). */
  label?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 20, label, strokeWidth = 1.75, className, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      className={["shrink-0", className].filter(Boolean).join(" ")}
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
