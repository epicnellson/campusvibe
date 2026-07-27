/** Responsive breakpoint values (px). */
export const BREAKPOINTS = {
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

/** Sidebar width when expanded. */
export const SIDEBAR_WIDTH = 260;

/** Sidebar width when collapsed (icons only). */
export const SIDEBAR_COLLAPSED_WIDTH = 72;

/** Max width for centered content areas. */
export const CONTENT_MAX_WIDTH = 800;

/** Max width for wide layouts (chat split-view, etc). */
export const WIDE_MAX_WIDTH = 1200;

/** Grid columns by breakpoint. */
export const GRID_COLUMNS = {
  sm: 2,
  md: 3,
  lg: 4,
  xl: 4,
} as const;
