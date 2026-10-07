import { unzipSync } from "fflate";
import type { InputFile } from "./types";

const MAX_DEPTH = 3;

/** Wrap raw bytes as an InputFile. */
export function bytesFile(name: string, data: Uint8Array): InputFile {
  return {
    name,
    bytes: async () => data,
    text: async () => new TextDecoder("utf-8").decode(data),
  };
}

function isZipName(name: string): boolean {
  return name.toLowerCase().endsWith(".zip");
}

function isJunkEntry(path: string): boolean {
  const parts = path.split("/");
  const base = parts[parts.length - 1] ?? "";
  return base === "" || parts.includes("__MACOSX") || base.startsWith("._") || base === ".DS_Store";
}

async function expand(file: InputFile, depth: number): Promise<InputFile[]> {
  if (!isZipName(file.name) || depth >= MAX_DEPTH) return [file];
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(await file.bytes());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not read zip "${file.name}": ${msg}`);
  }
  const out: InputFile[] = [];
  for (const [path, data] of Object.entries(entries)) {
    if (isJunkEntry(path)) continue;
    out.push(...(await expand(bytesFile(path, data), depth + 1)));
  }
  return out;
}

/** Expand any .zip inputs (recursively, entry names keep their in-archive path); other files pass through. */
export async function expandZips(files: InputFile[]): Promise<InputFile[]> {
  const out: InputFile[] = [];
  for (const f of files) out.push(...(await expand(f, 0)));
  return out;
}
