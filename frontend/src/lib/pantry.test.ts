import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addSavedItem,
  clearSavedList,
  getSavedLines,
  getSelectedLocation,
  onSavedListChange,
  savedItem,
  setSavedQuantity,
  setSelectedLocation,
} from "./pantry";

describe("selected pantry", () => {
  beforeEach(() => localStorage.clear());

  it("persists the selected location and notifies listeners", () => {
    const listener = vi.fn();
    const unsubscribe = onSavedListChange(listener);

    setSelectedLocation("pantry-1");

    expect(getSelectedLocation()).toBe("pantry-1");
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });
});

describe("saved shopping list", () => {
  beforeEach(() => localStorage.clear());

  it("adds items and increments an existing quantity", () => {
    addSavedItem("pantry-1", 42);
    addSavedItem("pantry-1", 42, 2);

    expect(getSavedLines("pantry-1")).toEqual([{ item_id: 42, quantity: 3 }]);
  });

  it("caps item quantities at 99", () => {
    addSavedItem("pantry-1", 42, 120);
    addSavedItem("pantry-1", 42);

    expect(getSavedLines("pantry-1")).toEqual([{ item_id: 42, quantity: 99 }]);
  });

  it("rejects more than 100 different items", () => {
    for (let itemId = 1; itemId <= 100; itemId += 1) {
      addSavedItem("pantry-1", itemId);
    }

    expect(() => addSavedItem("pantry-1", 101)).toThrow(
      "A pickup list can contain at most 100 different items.",
    );
  });

  it("updates or removes an item's quantity", () => {
    addSavedItem("pantry-1", 1, 2);
    addSavedItem("pantry-1", 2);

    setSavedQuantity("pantry-1", 1, 4);
    setSavedQuantity("pantry-1", 2, 0);

    expect(getSavedLines("pantry-1")).toEqual([{ item_id: 1, quantity: 4 }]);
  });

  it("clears the list and notifies listeners", () => {
    const listener = vi.fn();
    addSavedItem("pantry-1", 1);
    const unsubscribe = onSavedListChange(listener);

    clearSavedList("pantry-1");

    expect(getSavedLines("pantry-1")).toEqual([]);
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("removes malformed stored JSON", () => {
    localStorage.setItem("pantry-owl:list:pantry-1", "{invalid");

    expect(getSavedLines("pantry-1")).toEqual([]);
    expect(localStorage.getItem("pantry-owl:list:pantry-1")).toBeNull();
  });

  it("filters invalid saved entries", () => {
    localStorage.setItem(
      "pantry-owl:list:pantry-1",
      JSON.stringify([
        { item_id: 1, quantity: 2 },
        { item_id: 2, quantity: 0 },
        { item_id: 3.5, quantity: 1 },
        { item_id: 4, quantity: 100 },
      ]),
    );

    expect(getSavedLines("pantry-1")).toEqual([{ item_id: 1, quantity: 2 }]);
  });

  it("converts an item to a saved list entry", () => {
    expect(
      savedItem(
        {
          id: 42,
          name: "Test item",
          description: null,
          price: null,
          image_url: null,
          tags: [],
        },
        3,
      ),
    ).toEqual({ item_id: 42, quantity: 3 });
  });
});
