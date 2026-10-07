import { db, DEFAULT_SETTINGS } from "./db";
import type { Settings, UserList } from "./types";

type ListItem = Omit<UserList["items"][number], "addedAt">;

function requiredText(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required.`);
  return trimmed;
}

export async function createList(
  name: string,
  description?: string,
): Promise<UserList> {
  const now = Date.now();
  const list: UserList = {
    id: crypto.randomUUID(),
    name: requiredText(name, "List name"),
    description: description?.trim(),
    items: [],
    createdAt: now,
    updatedAt: now,
  };
  await db().lists.add(list);
  return list;
}

async function changeList(
  listId: string,
  change: (list: UserList) => void,
): Promise<UserList> {
  const database = db();
  return database.transaction("rw", database.lists, async () => {
    const list = await database.lists.get(listId);
    if (!list) throw new Error("List not found.");
    change(list);
    list.updatedAt = Date.now();
    await database.lists.put(list);
    return list;
  });
}

export async function renameList(
  listId: string,
  name: string,
  description?: string,
): Promise<UserList> {
  const trimmed = requiredText(name, "List name");
  return changeList(listId, (list) => {
    list.name = trimmed;
    if (description !== undefined) list.description = description.trim();
  });
}

export async function deleteList(listId: string): Promise<void> {
  await db().lists.delete(listId);
}

export async function addToList(
  listId: string,
  item: ListItem,
): Promise<UserList> {
  const id = requiredText(item.id, "Item ID");
  const title = requiredText(item.title, "Item title");
  if (item.kind !== "show" && item.kind !== "movie") {
    throw new Error("Item must be a show or movie.");
  }
  return changeList(listId, (list) => {
    if (
      !list.items.some((entry) => entry.id === id && entry.kind === item.kind)
    ) {
      list.items.push({ id, title, kind: item.kind, addedAt: Date.now() });
    }
  });
}

export async function removeFromList(
  listId: string,
  item: Pick<ListItem, "id" | "kind">,
): Promise<UserList> {
  return changeList(listId, (list) => {
    list.items = list.items.filter(
      (entry) => entry.id !== item.id || entry.kind !== item.kind,
    );
  });
}

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await db().settings.get("settings")) };
}

export async function updateSettings(
  patch: Partial<Omit<Settings, "id">>,
): Promise<Settings> {
  const database = db();
  return database.transaction("rw", database.settings, async () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      ...(await database.settings.get("settings")),
      ...patch,
      id: "settings",
    };
    await database.settings.put(settings);
    return settings;
  });
}
