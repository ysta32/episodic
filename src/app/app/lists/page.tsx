"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useState, type FormEvent } from "react";
import { db } from "@/lib/db";
import { createList } from "@/lib/lists";

const inputClass =
  "min-h-11 w-full rounded-xl border border-border bg-bg px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

export default function ListsPage() {
  const lists = useLiveQuery(() =>
    db().lists.orderBy("updatedAt").reverse().toArray(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await createList(
        String(data.get("name") ?? ""),
        String(data.get("description") ?? ""),
      );
      form.reset();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not create the list. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 bg-bg p-4 text-text sm:p-8">
      <header>
        <h1 className="text-3xl font-semibold">Your lists</h1>
        <p className="mt-2 text-muted">
          Collect shows and movies for every mood.
        </p>
      </header>
      <form
        onSubmit={create}
        className="space-y-4 rounded-2xl border border-border bg-surface p-5"
      >
        <h2 className="text-xl font-semibold">Create a list</h2>
        <label className="block space-y-2">
          <span>Name</span>
          <input name="name" required className={inputClass} disabled={busy} />
        </label>
        <label className="block space-y-2">
          <span>Description (optional)</span>
          <textarea
            name="description"
            rows={2}
            className={inputClass}
            disabled={busy}
          />
        </label>
        <button
          disabled={busy}
          className="min-h-11 rounded-xl bg-accent px-4 py-2 font-semibold text-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent2 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create list"}
        </button>
        {error && (
          <p role="alert" className="text-accent">
            {error}
          </p>
        )}
      </form>
      {lists === undefined ? (
        <p role="status" className="text-muted">
          Loading lists…
        </p>
      ) : lists.length === 0 ? (
        <p className="text-muted">
          No lists yet. Create your first one above, then add titles from your
          library.
        </p>
      ) : (
        <ul className="space-y-3">
          {lists.map((list) => (
            <li key={list.id}>
              <Link
                href={`/app/lists/${encodeURIComponent(list.id)}`}
                className="block min-h-11 rounded-2xl border border-border bg-surface p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <h2 className="break-words text-xl font-semibold">
                  {list.name}
                </h2>
                {list.description && (
                  <p className="mt-1 break-words text-muted">
                    {list.description}
                  </p>
                )}
                <p className="mt-2 text-sm text-muted">
                  {list.items.length}{" "}
                  {list.items.length === 1 ? "title" : "titles"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
