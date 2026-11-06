import { Item } from "./api";

type SavedLine = { item_id: number; quantity: number };

const LOCATION_KEY = "pantry-owl:location";
const LIST_EVENT = "pantry-owl:list-updated";

function listKey(locationId: string): string {
  return `pantry-owl:list:${locationId}`;
}

export function getSelectedLocation(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(LOCATION_KEY);
}

export function setSelectedLocation(locationId: string): void {
  window.localStorage.setItem(LOCATION_KEY, locationId);
  window.dispatchEvent(new Event(LIST_EVENT));
}

export function getSavedLines(locationId: string): SavedLine[] {
  const key = listKey(locationId);
  const raw = window.localStorage.getItem(key);
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    window.localStorage.removeItem(key);
    return [];
  }
  if (!Array.isArray(parsed)) {
    window.localStorage.removeItem(key);
    return [];
  }
  return parsed.filter(
    (line): line is SavedLine =>
      typeof line?.item_id === "number" &&
      Number.isInteger(line.item_id) &&
      typeof line?.quantity === "number" &&
      Number.isInteger(line.quantity) &&
      line.quantity > 0 &&
      line.quantity <= 99,
  );
}

function saveLines(locationId: string, lines: SavedLine[]): void {
  window.localStorage.setItem(listKey(locationId), JSON.stringify(lines));
  window.dispatchEvent(new Event(LIST_EVENT));
}

export function addSavedItem(locationId: string, itemId: number, amount = 1): void {
  const lines = getSavedLines(locationId);
  const existing = lines.find((line) => line.item_id === itemId);
  if (existing) existing.quantity = Math.min(99, existing.quantity + amount);
  else {
    if (lines.length >= 100) throw new Error("A pickup list can contain at most 100 different items.");
    lines.push({ item_id: itemId, quantity: Math.min(99, amount) });
  }
  saveLines(locationId, lines);
}

export function setSavedQuantity(locationId: string, itemId: number, quantity: number): void {
  const lines = getSavedLines(locationId);
  if (quantity <= 0) saveLines(locationId, lines.filter((line) => line.item_id !== itemId));
  else saveLines(
    locationId,
    lines.map((line) => line.item_id === itemId ? { ...line, quantity: Math.min(99, quantity) } : line),
  );
}

export function clearSavedList(locationId: string): void {
  saveLines(locationId, []);
}

export function onSavedListChange(callback: () => void): () => void {
  window.addEventListener(LIST_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(LIST_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function savedItem(item: Item, quantity: number): { item_id: number; quantity: number } {
  return { item_id: item.id, quantity };
}
