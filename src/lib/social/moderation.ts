export const HIDE_AT_REPORTS = 3;
export const MAX_BODY = 1000;
export const MAX_LINKS = 2;

export interface ModerationResult {
  ok: boolean;
  reason?: string;
  clean: string;
}

// C0/C1 control chars except \t and \n, plus zero-width and bidi-override characters.
const CONTROL_RE = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
const LINK_RE = /\b(?:https?:\/\/|www\.)[^\s]+/gi;

// Whole-token matches after leetspeak normalization. Kept short and explicit on purpose.
const BLOCKED_TOKENS: readonly string[] = [
  "nigger", "nigga", "faggot", "fag", "retard", "kike", "spic", "chink", "tranny", "wetback", "coon",
];
const SPAM_PHRASES: readonly string[] = [
  "free crypto", "crypto giveaway", "double your bitcoin", "onlyfans", "telegram me", "whatsapp me",
  "dm me on telegram", "click here to win", "work from home and earn", "cheap viagra",
];

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "@": "a", "5": "s", "$": "s", "7": "t" };

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036F]/g, "")
    .replace(/[0134@5$7]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z]+/g, " ")
    .trim();
}

function collapseWhitespace(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function moderate(body: string): ModerationResult {
  if (typeof body !== "string") return { ok: false, reason: "invalid", clean: "" };
  const clean = collapseWhitespace(body.replace(CONTROL_RE, ""));
  if (clean.length < 1) return { ok: false, reason: "empty", clean };
  if (clean.length > MAX_BODY) return { ok: false, reason: "too_long", clean };
  const links = clean.match(LINK_RE);
  if (links && links.length > MAX_LINKS) return { ok: false, reason: "too_many_links", clean };
  if (/([\s\S])\1{24,}/.test(clean)) return { ok: false, reason: "spam", clean };

  const norm = normalizeForMatch(clean);
  const tokens = norm.split(" ");
  for (const t of tokens) {
    for (const bad of BLOCKED_TOKENS) {
      if (t === bad || t === `${bad}s` || t === `${bad}z`) return { ok: false, reason: "blocked", clean };
    }
  }
  const padded = ` ${norm} `;
  for (const p of SPAM_PHRASES) {
    if (padded.includes(` ${p} `)) return { ok: false, reason: "spam", clean };
  }
  return { ok: true, clean };
}
