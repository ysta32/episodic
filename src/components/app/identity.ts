const KEY = "episodic.authorId";
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export interface Identity {
  authorId: string;
  author: string;
}

function newId(): string {
  return crypto.randomUUID();
}

/** Stable anonymous id persisted on this device. Falls back to an in-memory id if storage is blocked. */
let memoryId: string | null = null;

function readAuthorId(): string {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored && ID_RE.test(stored)) return stored;
    const fresh = newId();
    localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    memoryId ??= newId();
    return memoryId;
  }
}

/**
 * Browser-only. `displayName` comes from settings.displayName (read via Dexie by the caller);
 * without one the author reads "Viewer-xxxx" from the id.
 */
export function getIdentity(displayName?: string): Identity {
  const authorId = readAuthorId();
  const name = displayName?.replace(/\s+/g, " ").trim().slice(0, 40);
  return { authorId, author: name || `Viewer-${authorId.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toLowerCase()}` };
}
