"use client";

import { useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import { exportCsv, exportJson } from "@/lib/export";

export default function ExportPanel() {
  const locked = useRef(false);
  const [busy, setBusy] = useState<"json" | "csv" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function download(format: "json" | "csv") {
    if (locked.current) return;
    locked.current = true;
    setBusy(format);
    setError("");
    setMessage("");
    try {
      const contents = await (format === "json" ? exportJson() : exportCsv());
      const blob = new Blob([contents], {
        type:
          format === "json"
            ? "application/json;charset=utf-8"
            : "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      try {
        anchor.href = url;
        anchor.download = `episodic-${format === "json" ? "backup" : "history"}-${new Date().toISOString().slice(0, 10)}.${format}`;
        document.body.append(anchor);
        anchor.click();
        setMessage(
          `${format.toUpperCase()} download started. Keep a copy somewhere safe.`,
        );
      } finally {
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch {
      setError(
        "Couldn't prepare your download. Your library is unchanged. Try downloading again.",
      );
    } finally {
      locked.current = false;
      setBusy(null);
    }
  }

  return (
    <section
      id="export"
      aria-labelledby="export-heading"
      className="space-y-4 border-t border-line pt-8"
    >
      <p className="k-slate text-text-2">Always yours</p>
      <h2 id="export-heading" className="font-display text-k-2xl">
        Take your history with you
      </h2>
      <Card className="space-y-5">
        <p className="max-w-[68ch] text-text-2">
          Save a full JSON backup of your library, watches, ratings, lists, and
          settings, or a CSV of your watch history. Both work offline. No
          account needed.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            size="lg"
            leadingIcon="export"
            disabled={busy !== null}
            loading={busy === "json"}
            onClick={() => void download("json")}
          >
            Download JSON backup
          </Button>
          <Button
            size="lg"
            variant="secondary"
            disabled={busy !== null}
            loading={busy === "csv"}
            onClick={() => void download("csv")}
          >
            Download CSV
          </Button>
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-k-sm border border-danger p-3 text-danger"
          >
            {error}
          </p>
        )}
        <p role="status" className="text-k-sm text-text-2">
          {message}
        </p>
      </Card>
    </section>
  );
}
