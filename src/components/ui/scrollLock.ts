/**
 * Ref-counted document scroll lock shared by Dialog, Sheet and CommandPalette.
 * The original overflow is captured on the first lock and restored only when the last lock is released,
 * so overlapping or out-of-order closes never restore a stale value.
 */
let count = 0;
let original = "";

export function lockScroll(): () => void {
  const root = document.documentElement;
  if (count === 0) {
    original = root.style.overflow;
    root.style.overflow = "hidden";
  }
  count += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    count = Math.max(0, count - 1);
    if (count === 0) root.style.overflow = original;
  };
}
