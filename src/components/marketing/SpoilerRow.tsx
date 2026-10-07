"use client";

import { useId, useState } from "react";
import { Icon } from "@/components/ui/Icon";

/** Spoiler Shield preview row: redacted text stays out of the accessibility tree until the reader reveals it. */
export function SpoilerRow({ slate, title, synopsis }: { slate: string; title: string; synopsis: string }) {
  const [revealed, setRevealed] = useState(false);
  const contentId = useId();
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <span className="k-slate mt-1 w-11 shrink-0 text-text-3">{slate}</span>
      <div id={contentId} className="min-w-0 flex-1">
        <p className="k-redact text-k-base font-medium" data-revealed={revealed || undefined} aria-hidden={!revealed}>
          {title}
        </p>
        <p className="k-redact mt-1 text-k-sm text-text-2" data-revealed={revealed || undefined} aria-hidden={!revealed}>
          {synopsis}
        </p>
        {!revealed && <span className="sr-only">Episode title and synopsis hidden by Spoiler Shield.</span>}
      </div>
      <button
        type="button"
        aria-expanded={revealed}
        aria-controls={contentId}
        onClick={() => setRevealed((r) => !r)}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-k-sm border border-line-strong px-2.5 text-k-xs font-semibold text-text-2 transition-colors duration-(--k-dur-1) hover:bg-surface-2 hover:text-text"
      >
        <Icon name={revealed ? "spoiler" : "eye"} size={14} />
        {revealed ? "Hide" : "Reveal"}
      </button>
    </div>
  );
}
