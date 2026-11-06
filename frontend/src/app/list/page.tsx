"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, CheckoutPreview, Item, Location } from "@/lib/api";
import {
  clearSavedList,
  getSavedLines,
  getSelectedLocation,
  onSavedListChange,
  setSavedQuantity,
  setSelectedLocation,
} from "@/lib/pantry";

type DisplayLine = { item: Item; quantity: number };
type PickupQr = { dataUrl: string; payload: string };

export default function ListPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [lines, setLines] = useState<DisplayLine[]>([]);
  const [templeId, setTempleId] = useState("");
  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const [qr, setQr] = useState<PickupQr | null>(null);
  const [error, setError] = useState("");

  const selectedLocation = locations.find((location) => location.id === locationId);
  const loadLines = useCallback(async (selectedId: string) => {
    if (!selectedId) {
      setLines([]);
      return;
    }
    const saved = getSavedLines(selectedId);
    const resolved = await Promise.all(saved.map(async (line) => ({
      item: await api<Item>(`/items/${line.item_id}?location_id=${selectedId}`),
      quantity: line.quantity,
    })));
    setLines(resolved);
  }, []);

  useEffect(() => {
    api<Location[]>("/locations")
      .then(async (result) => {
        setLocations(result);
        const preferred = getSelectedLocation();
        const selected = result.find((location) => location.id === preferred) ?? result[0];
        if (selected) {
          setLocationId(selected.id);
          setSelectedLocation(selected.id);
          await loadLines(selected.id);
        }
      })
      .catch((e: Error) => setError(e.message));
    return onSavedListChange(() => {
      const current = getSelectedLocation();
      if (current) {
        setLocationId(current);
        loadLines(current).catch((e: Error) => setError(e.message));
      }
    });
  }, [loadLines]);

  useEffect(() => {
    setPreview(null);
    setQr(null);
    if (!locationId || !templeId.trim() || lines.length === 0) return;
    const timeout = window.setTimeout(() => {
      api<CheckoutPreview>("/checkout/preview", {
        method: "POST",
        body: JSON.stringify({
          location_id: locationId,
          temple_id: templeId.trim(),
          lines: lines.map(({ item, quantity }) => ({ item_id: item.id, quantity })),
        }),
      })
        .then(setPreview)
        .catch((e: Error) => setError(e.message));
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [locationId, templeId, lines]);

  const totalItems = useMemo(() => lines.reduce((sum, line) => sum + line.quantity, 0), [lines]);

  async function changeQuantity(itemId: number, quantity: number) {
    if (!locationId) return;
    setSavedQuantity(locationId, itemId, quantity);
    await loadLines(locationId);
    setPreview(null);
    setQr(null);
  }

  async function generateQr() {
    if (!preview?.eligible || !selectedLocation || !selectedLocation.open_now) return;
    setError("");
    const payload = JSON.stringify({
      version: 1,
      location_id: locationId,
      temple_id: templeId.trim(),
      qr_nonce: crypto.randomUUID(),
      lines: lines.map(({ item, quantity }) => ({ item_id: item.id, quantity })),
    });
    try {
      setQr({ dataUrl: await QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 2, width: 320 }), payload });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="stack page-stack">
      <h1>My shopping list</h1>
      {locations.length > 1 && (
        <label className="stack">
          Pantry location
          <select
            value={locationId}
            onChange={(event) => {
              const next = event.target.value;
              setLocationId(next);
              setSelectedLocation(next);
              setQr(null);
              loadLines(next).catch((e: Error) => setError(e.message));
            }}
          >
            {locations.map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}
          </select>
        </label>
      )}
      {!locations.length && <p className="muted">No active pantry locations are available.</p>}
      {selectedLocation && (
        <p className={selectedLocation.open_now ? "status-open" : "status-closed"}>
          {selectedLocation.name}: {selectedLocation.status_message}
        </p>
      )}
      {lines.length === 0 && <p className="muted">Your saved list is empty for this location.</p>}
      {lines.map(({ item, quantity }) => (
        <div className="row list-line" key={item.id}>
          <div>
            <Link href={`/items/${item.id}`}>{item.name}</Link>
            {item.location_stock?.limit_per_person != null && (
              <p className="muted">
                Weekly limit: {item.location_stock.limit_per_person}
                {preview?.lines.find((line) => line.item_id === item.id)?.remaining_item_limit != null
                  ? ` · You can take ${preview.lines.find((line) => line.item_id === item.id)?.remaining_item_limit} more`
                  : ""}
              </p>
            )}
          </div>
          <div className="quantity-controls">
            <button aria-label={`Remove one ${item.name}`} onClick={() => changeQuantity(item.id, quantity - 1)}>−</button>
            <span>{quantity}</span>
            <button aria-label={`Add one ${item.name}`} onClick={() => changeQuantity(item.id, quantity + 1)} disabled={quantity >= 99}>+</button>
            <button className="secondary-button" onClick={() => changeQuantity(item.id, 0)}>Remove</button>
          </div>
        </div>
      ))}
      {!!lines.length && (
        <>
          <p>{totalItems} item{totalItems === 1 ? "" : "s"}</p>
          <button className="secondary-button" onClick={() => locationId && clearSavedList(locationId)}>Clear list</button>
          <label className="stack">
            Temple ID
            <input
              autoComplete="off"
              maxLength={128}
              value={templeId}
              onChange={(event) => setTempleId(event.target.value)}
              placeholder="Enter the ID to use at pickup"
            />
          </label>
          <p className="muted">Your cashier will verify your physical ID before completing checkout. Your Temple ID is encoded in the QR and is not saved by this page.</p>
          {preview && (
            <section className="summary-card">
              <h2>Weekly points</h2>
              <p>{preview.remaining_points} of {preview.weekly_points} points remaining before this list.</p>
              <p>This list: {preview.total_points} points · After pickup: {Math.max(preview.remaining_points - preview.total_points, 0)} points</p>
              {preview.errors.map((message) => <p className="error" key={message}>{message}</p>)}
            </section>
          )}
          {error && <p className="error" role="alert">{error}</p>}
          <button
            onClick={generateQr}
            disabled={!preview?.eligible || !selectedLocation?.open_now}
          >
            Generate pickup QR
          </button>
          {qr && (
            <section className="qr-card">
              <h2>Show this code to the cashier</h2>
              <img src={qr.dataUrl} alt="Pickup QR code" />
              <p className="muted">This code is for {selectedLocation?.name} and can only be redeemed once.</p>
              <details><summary>Pickup code details</summary><pre>{qr.payload}</pre></details>
            </section>
          )}
        </>
      )}
      {error && !preview && <p className="error" role="alert">{error}</p>}
      <Link href="/">Continue browsing</Link>
    </div>
  );
}
