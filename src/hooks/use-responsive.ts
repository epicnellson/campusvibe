import { useMemo } from "react";
import { useWindowDimensions, Platform } from "react-native";
import { BREAKPOINTS, SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from "@/constants/breakpoints";

export type Breakpoint = "sm" | "md" | "lg" | "xl";

export function useResponsive() {
  const { width, height } = useWindowDimensions();

  const breakpoint: Breakpoint = useMemo(() => {
    if (width >= BREAKPOINTS.xl) return "xl";
    if (width >= BREAKPOINTS.lg) return "lg";
    if (width >= BREAKPOINTS.md) return "md";
    return "sm";
  }, [width]);

  const isWeb = Platform.OS === "web";
  const isMobile = breakpoint === "sm";
  const isTablet = breakpoint === "md";
  const isDesktop = breakpoint === "lg" || breakpoint === "xl";
  const isWideScreen = width >= BREAKPOINTS.lg;

  /** Whether to show the sidebar instead of the bottom tab bar. */
  const showSidebar = isWeb && isWideScreen;

  /** Width available for content after sidebar. */
  const contentWidth = showSidebar ? width - SIDEBAR_WIDTH : width;

  /** Number of grid columns for marketplace-style grids. */
  const gridColumns = breakpoint === "xl" ? 4 : breakpoint === "lg" ? 3 : breakpoint === "md" ? 3 : 2;

  return {
    width,
    height,
    breakpoint,
    isWeb,
    isMobile,
    isTablet,
    isDesktop,
    isWideScreen,
    showSidebar,
    contentWidth,
    gridColumns,
    sidebarWidth: showSidebar ? SIDEBAR_WIDTH : 0,
  };
}
