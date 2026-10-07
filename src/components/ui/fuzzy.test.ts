import { describe, expect, it } from "vitest";
import { fuzzyMatch } from "./fuzzy";

describe("fuzzyMatch", () => {
  it("matches subsequences case-insensitively and rejects non-matches", () => {
    expect(fuzzyMatch("gtl", "Go to Library")?.indices).toEqual([0, 3, 6]);
    expect(fuzzyMatch("xyz", "Go to Library")).toBeNull();
    expect(fuzzyMatch("", "anything")).toEqual({ score: 0, indices: [] });
  });

  it("ranks prefix and word-start matches above scattered ones", () => {
    const prefix = fuzzyMatch("imp", "Import history")!.score;
    const scattered = fuzzyMatch("imp", "Skip empty seasons")!.score;
    expect(prefix).toBeGreaterThan(scattered);
    const wordStart = fuzzyMatch("cal", "Open calendar")!.score;
    const mid = fuzzyMatch("cal", "Technical notes")!.score;
    expect(wordStart).toBeGreaterThan(mid);
  });
});
