import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setDb, db, DEFAULT_SETTINGS, EpisodicDB } from "./db";
import {
  addToList,
  createList,
  deleteList,
  getSettings,
  removeFromList,
  renameList,
  updateSettings,
} from "./lists";

beforeEach(() => {
  __setDb(new EpisodicDB(`lists-test-${crypto.randomUUID()}`));
});

afterEach(async () => {
  await db().delete();
});

describe("lists", () => {
  it("creates distinct persisted lists with trimmed names and descriptions", async () => {
    const before = Date.now();
    const first = await createList(" Weekend ", " Watch together ");
    const second = await createList("Weekend");
    expect(first.id).not.toBe(second.id);
    expect(first).toMatchObject({
      name: "Weekend",
      description: "Watch together",
      items: [],
    });
    expect(first.createdAt).toBeGreaterThanOrEqual(before);
    expect(first.updatedAt).toBe(first.createdAt);
    expect(await db().lists.get(first.id)).toEqual(first);
  });

  it("rejects empty names without changing stored lists", async () => {
    await expect(createList(" \n ")).rejects.toThrow("List name is required");
    const list = await createList("Original");
    await expect(renameList(list.id, " ")).rejects.toThrow(
      "List name is required",
    );
    expect(await db().lists.toArray()).toEqual([list]);
  });

  it("renames without losing items, creation time, or an omitted description", async () => {
    const list = await createList("Original", "Description");
    await addToList(list.id, { id: "tvmaze:1", kind: "show", title: "A show" });
    const renamed = await renameList(list.id, " Renamed ");
    expect(renamed).toMatchObject({
      name: "Renamed",
      description: "Description",
      createdAt: list.createdAt,
    });
    expect(renamed.items).toHaveLength(1);
    expect(renamed.updatedAt).toBeGreaterThanOrEqual(list.updatedAt);
    await renameList(list.id, "Renamed", "");
    expect((await db().lists.get(list.id))?.description).toBe("");
  });

  it("keeps distinct media kinds and makes duplicate additions idempotent", async () => {
    const list = await createList("Favorites");
    const show = { id: "shared-id", kind: "show", title: "Show" } as const;
    await addToList(list.id, show);
    const original = (await db().lists.get(list.id))?.items[0];
    await addToList(list.id, { ...show, title: "New title" });
    await addToList(list.id, { ...show, kind: "movie", title: "Movie" });
    const stored = await db().lists.get(list.id);
    expect(stored?.items).toHaveLength(2);
    expect(stored?.items[0]).toEqual(original);
    expect(original?.addedAt).toBeGreaterThan(0);
    await removeFromList(list.id, show);
    expect((await db().lists.get(list.id))?.items).toEqual([
      expect.objectContaining({ kind: "movie", title: "Movie" }),
    ]);
    await removeFromList(list.id, show);
    expect((await db().lists.get(list.id))?.items).toHaveLength(1);
  });

  it("preserves concurrent additions and renames", async () => {
    const list = await createList("Original");
    await Promise.all([
      addToList(list.id, { id: "tvmaze:1", kind: "show", title: "One" }),
      addToList(list.id, { id: "tvmaze:2", kind: "show", title: "Two" }),
      renameList(list.id, "Renamed"),
    ]);
    const stored = await db().lists.get(list.id);
    expect(stored?.name).toBe("Renamed");
    expect(stored?.items.map((item) => item.id).sort()).toEqual([
      "tvmaze:1",
      "tvmaze:2",
    ]);
  });

  it("rejects incomplete items without mutating a list", async () => {
    const list = await createList("Test");
    await expect(
      addToList(list.id, { id: "", kind: "show", title: "Show" }),
    ).rejects.toThrow("Item ID is required");
    await expect(
      addToList(list.id, { id: "tvmaze:1", kind: "show", title: " " }),
    ).rejects.toThrow("Item title is required");
    expect(await db().lists.get(list.id)).toEqual(list);
  });

  it("reports missing lists instead of recreating them", async () => {
    await expect(renameList("missing", "Name")).rejects.toThrow(
      "List not found",
    );
    await expect(
      addToList("missing", { id: "tvmaze:1", kind: "show", title: "Show" }),
    ).rejects.toThrow("List not found");
    await expect(
      removeFromList("missing", { id: "tvmaze:1", kind: "show" }),
    ).rejects.toThrow("List not found");
    expect(await db().lists.count()).toBe(0);
  });

  it("deletes only the selected list and preserves the library and watch history", async () => {
    const list = await createList("Delete me");
    const keep = await createList("Keep me");
    await db().library.add({
      id: "tvmaze:1",
      kind: "show",
      title: "Show",
      ids: { tvmaze: 1 },
      status: "watching",
      addedAt: 1,
      updatedAt: 1,
    });
    await db().watches.add({
      id: "watch",
      kind: "episode",
      mediaId: "tvmaze:1:s1e1",
      showId: "tvmaze:1",
      watchedAt: 1,
      source: "manual",
    });
    await deleteList(list.id);
    await deleteList(list.id);
    expect(await db().lists.toArray()).toEqual([keep]);
    expect(await db().library.count()).toBe(1);
    expect(await db().watches.count()).toBe(1);
  });
});

describe("settings", () => {
  it("returns independent defaults on a fresh device", async () => {
    const settings = await getSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
    settings.theme = "light";
    expect((await getSettings()).theme).toBe("system");
    expect(DEFAULT_SETTINGS.theme).toBe("system");
  });

  it("persists profile preferences and merges partial updates", async () => {
    await updateSettings({
      displayName: "Alex",
      theme: "dark",
      spoilerMode: "hide",
    });
    await updateSettings({ theme: "light" });
    expect(await getSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      displayName: "Alex",
      theme: "light",
      spoilerMode: "hide",
    });
    expect(await db().settings.count()).toBe(1);
  });

  it("records waitlist interest without enabling supporter status or sync", async () => {
    await updateSettings({ supporterWaitlist: true });
    expect(await db().settings.get("settings")).toEqual({
      ...DEFAULT_SETTINGS,
      supporterWaitlist: true,
    });
  });

  it("does not lose concurrent settings patches", async () => {
    await Promise.all([
      updateSettings({ displayName: "Alex" }),
      updateSettings({ theme: "dark" }),
      updateSettings({ supporterWaitlist: true }),
    ]);
    expect(await getSettings()).toMatchObject({
      displayName: "Alex",
      theme: "dark",
      supporterWaitlist: true,
    });
  });
});
