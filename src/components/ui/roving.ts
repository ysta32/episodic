/** Shared arrow-key navigation for roving-tabindex groups. Returns the next index or null if the key is unhandled. */
export function nextIndex(key: string, current: number, count: number, orientation: "horizontal" | "vertical" | "both" = "horizontal"): number | null {
  if (count === 0) return null;
  const prev = orientation === "both" ? ["ArrowLeft", "ArrowUp"] : orientation === "horizontal" ? ["ArrowLeft"] : ["ArrowUp"];
  const next = orientation === "both" ? ["ArrowRight", "ArrowDown"] : orientation === "horizontal" ? ["ArrowRight"] : ["ArrowDown"];
  if (prev.includes(key)) return (current - 1 + count) % count;
  if (next.includes(key)) return (current + 1) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}
