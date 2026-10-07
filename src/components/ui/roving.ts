/** Shared arrow-key navigation for roving-tabindex groups. Returns the next index or null if the key is unhandled. */
export function nextIndex(key: string, current: number, count: number, orientation: "horizontal" | "vertical" = "horizontal"): number | null {
  if (count === 0) return null;
  const prev = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
  const next = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
  if (key === prev) return (current - 1 + count) % count;
  if (key === next) return (current + 1) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}
