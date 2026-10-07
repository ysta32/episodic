import Link from "next/link";
import { APP_HREF, IMPORT_HREF } from "./site";

const base =
  "inline-flex min-h-12 items-center justify-center rounded-full px-6 text-base font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function ImportButton({ label = "Import from TV Time" }: { label?: string }) {
  return (
    <Link
      href={IMPORT_HREF}
      className={`${base} bg-accent text-accent-ink shadow-lg shadow-accent/25 hover:brightness-110`}
    >
      {label}
    </Link>
  );
}

export function OpenAppButton() {
  return (
    <Link
      href={APP_HREF}
      className={`${base} border border-border bg-surface text-text hover:border-muted`}
    >
      Open app
    </Link>
  );
}

export function CtaPair() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <ImportButton />
      <OpenAppButton />
    </div>
  );
}
