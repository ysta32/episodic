"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useState, type FormEvent } from "react";
import { db } from "@/lib/db";
import { addToList, deleteList, removeFromList, renameList } from "@/lib/lists";

const controlClass =
  "min-h-11 rounded-xl border border-border bg-bg px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50";

export default function ListPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const result = useLiveQuery(
    async () => ({ list: await db().lists.get(id) }),
    [id],
  );
  const library = useLiveQuery(() => db().library.toArray());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function perform(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save changes. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void perform(() =>
      renameList(
        id,
        String(data.get("name") ?? ""),
        String(data.get("description") ?? ""),
      ),
    );
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selected = new FormData(event.currentTarget).get("item");
    const entry = library?.find(
      (item) => `${item.kind}:${item.id}` === selected,
    );
    if (entry) void perform(() => addToList(id, entry));
  }

  const list = result?.list;
  const available = library?.filter(
    (entry) =>
      !list?.items.some(
        (item) => item.id === entry.id && item.kind === entry.kind,
      ),
  );

  return (
    <main className="mx-auto max-w-3xl space-y-6 bg-bg p-4 text-text sm:p-8">
      <Link
        href="/app/lists"
        className="inline-flex min-h-11 items-center rounded-xl text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        ← All lists
      </Link>
      {!result ? (
        <p role="status">Loading list…</p>
      ) : !list ? (
        <h1 className="text-2xl font-semibold">List not found</h1>
      ) : (
        <>
          <h1 className="break-words text-3xl font-semibold">{list.name}</h1>
          <form
            onSubmit={rename}
            key={JSON.stringify([id, list.name, list.description])}
            className="space-y-4 rounded-2xl border border-border bg-surface p-5"
          >
            <label className="block space-y-2">
              <span>List name</span>
              <input
                name="name"
                required
                defaultValue={list.name}
                disabled={busy}
                className={`${controlClass} w-full`}
              />
            </label>
            <label className="block space-y-2">
              <span>Description</span>
              <textarea
                name="description"
                defaultValue={list.description ?? ""}
                disabled={busy}
                className={`${controlClass} w-full`}
              />
            </label>
            <button disabled={busy} className={controlClass}>
              Save list details
            </button>
          </form>
          <section className="space-y-3" aria-labelledby="titles-heading">
            <h2 id="titles-heading" className="text-xl font-semibold">
              Titles ({list.items.length})
            </h2>
            {list.items.length === 0 && (
              <p className="text-muted">
                This list is empty. Add a title from your library below.
              </p>
            )}
            <ul className="space-y-3">
              {list.items.map((item) => (
                <li
                  key={`${item.kind}:${item.id}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4"
                >
                  <div className="min-w-0">
                    <p className="break-words font-medium">{item.title}</p>
                    <p className="text-sm text-muted">
                      {item.kind === "show" ? "TV show" : "Movie"}
                    </p>
                  </div>
                  <button
                    disabled={busy}
                    onClick={() => void perform(() => removeFromList(id, item))}
                    aria-label={`Remove ${item.title} from list`}
                    className={`${controlClass} shrink-0`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </section>
          {available === undefined ? (
            <p role="status">Loading library…</p>
          ) : available.length > 0 ? (
            <form
              onSubmit={add}
              className="space-y-3 rounded-2xl border border-border bg-surface p-5"
            >
              <label className="block space-y-2">
                <span>Add from your library</span>
                <select
                  name="item"
                  required
                  disabled={busy}
                  className={`${controlClass} w-full`}
                >
                  {available.map((entry) => (
                    <option
                      key={`${entry.kind}:${entry.id}`}
                      value={`${entry.kind}:${entry.id}`}
                    >
                      {entry.title} ({entry.kind})
                    </option>
                  ))}
                </select>
              </label>
              <button disabled={busy} className={controlClass}>
                Add to list
              </button>
            </form>
          ) : (
            <p className="text-muted">
              No more library titles to add.{" "}
              <Link
                href="/app/library"
                className="inline-flex min-h-11 items-center rounded-xl text-accent focus-visible:ring-2 focus-visible:ring-accent"
              >
                Visit your library
              </Link>
            </p>
          )}
          <section
            className="space-y-3 rounded-2xl border border-border p-5"
            aria-label="Delete list"
          >
            {confirmDelete ? (
              <>
                <p>
                  Delete “{list.name}”? Your library and watch history will stay
                  on this device.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    disabled={busy}
                    className={`${controlClass} text-accent`}
                    onClick={() =>
                      void perform(async () => {
                        await deleteList(id);
                        router.push("/app/lists");
                      })
                    }
                  >
                    Confirm delete
                  </button>
                  <button
                    disabled={busy}
                    className={controlClass}
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <button
                disabled={busy}
                className={`${controlClass} text-accent`}
                onClick={() => setConfirmDelete(true)}
              >
                Delete list
              </button>
            )}
          </section>
          {busy && (
            <p role="status" className="text-muted">
              Saving…
            </p>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-accent">
          {error}
        </p>
      )}
    </main>
  );
}
