"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState, type FormEvent } from "react";
import { getSettings, updateSettings } from "@/lib/lists";

const controlClass =
  "min-h-11 w-full rounded-xl border border-border bg-bg px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50";
const links = [
  ["Import", "/app/import"],
  ["Export", "/app/export"],
  ["Stats", "/app/stats"],
  ["Lists", "/app/lists"],
  ["Supporter", "/app/supporter"],
] as const;

export default function ProfilePage() {
  const settings = useLiveQuery(() => getSettings());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (settings) document.documentElement.dataset.theme = settings.theme;
  }, [settings]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const theme = data.get("theme");
    const spoilerMode = data.get("spoilerMode");
    setMessage("");
    setError("");
    if (
      (theme !== "system" && theme !== "dark" && theme !== "light") ||
      (spoilerMode !== "blur" &&
        spoilerMode !== "hide" &&
        spoilerMode !== "show")
    ) {
      setError("Choose a theme and spoiler mode from the available options.");
      return;
    }
    setBusy(true);
    try {
      await updateSettings({
        displayName: String(data.get("displayName") ?? "").trim(),
        theme,
        spoilerMode,
      });
      document.documentElement.dataset.theme = theme;
      setMessage("Settings saved on this device.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save settings. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 bg-bg p-4 text-text sm:p-8">
      <h1 className="text-3xl font-semibold">Profile & settings</h1>
      {!settings ? (
        <p role="status">Loading settings…</p>
      ) : (
        <form
          onSubmit={save}
          key={JSON.stringify([
            settings.displayName,
            settings.theme,
            settings.spoilerMode,
          ])}
          className="space-y-5 rounded-2xl border border-border bg-surface p-5"
        >
          <label className="block space-y-2">
            <span>Display name</span>
            <input
              name="displayName"
              autoComplete="nickname"
              defaultValue={settings.displayName ?? ""}
              disabled={busy}
              className={controlClass}
            />
          </label>
          <label className="block space-y-2">
            <span>Spoiler mode</span>
            <select
              name="spoilerMode"
              defaultValue={settings.spoilerMode}
              disabled={busy}
              className={controlClass}
            >
              <option value="blur">Blur spoilers</option>
              <option value="hide">Hide spoilers</option>
              <option value="show">Show spoilers</option>
            </select>
          </label>
          <label className="block space-y-2">
            <span>Theme</span>
            <select
              name="theme"
              defaultValue={settings.theme}
              disabled={busy}
              className={controlClass}
            >
              <option value="system">Use device setting</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>
          <button
            disabled={busy}
            className="min-h-11 rounded-xl bg-accent px-4 py-2 font-semibold text-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent2 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save settings"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-accent">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-xl font-semibold">
          Your data lives on this device
        </h2>
        <p className="text-muted">
          Your library, watch history, lists, and settings are stored in this
          browser. Clearing browser data or losing this device can remove them.
          Export a backup to keep your history safe.
        </p>
        <p className="text-muted">Cloud sync: coming soon for supporters.</p>
      </section>
      <nav
        aria-label="Your account and data"
        className="grid gap-3 sm:grid-cols-2"
      >
        {links.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-11 items-center rounded-2xl border border-border bg-surface px-5 py-4 text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {label}
          </Link>
        ))}
      </nav>
    </main>
  );
}
