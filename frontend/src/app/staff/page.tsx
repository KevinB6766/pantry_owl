"use client";

import { BrowserQRCodeReader } from "@zxing/browser";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, CheckoutPreview, Item, Location } from "@/lib/api";

type Profile = { id: string; role: string; location_id: string | null };
type QrPayload = {
  version: 1;
  location_id: string;
  temple_id: string;
  qr_nonce: string;
  lines: { item_id: number; quantity: number }[];
};
type StockRow = {
  item_id: number;
  amount: number;
  available: boolean;
  limit_per_person: number | null;
  points_cost_override: number | null;
  items: Item;
};

function parseQr(value: string): QrPayload {
  const parsed: unknown = JSON.parse(value);
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("version" in parsed) ||
    parsed.version !== 1 ||
    !("location_id" in parsed) ||
    typeof parsed.location_id !== "string" ||
    !("temple_id" in parsed) ||
    typeof parsed.temple_id !== "string" ||
    !("qr_nonce" in parsed) ||
    typeof parsed.qr_nonce !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(parsed.qr_nonce) ||
    !("lines" in parsed) ||
    !Array.isArray(parsed.lines) ||
    parsed.lines.length < 1 ||
    parsed.lines.length > 100 ||
    !parsed.lines.every((line) =>
      line && typeof line === "object" &&
      "item_id" in line && Number.isInteger(line.item_id) && line.item_id > 0 &&
      "quantity" in line && Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 99,
    )
  ) {
    throw new Error("This QR code is not a valid Pantry Owl pickup code.");
  }
  return parsed as QrPayload;
}

function CameraScanner({ onScan }: { onScan: (value: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!active || !video.current) return;
    const reader = new BrowserQRCodeReader();
    let controls: { stop: () => void } | undefined;
    let mounted = true;
    reader.decodeFromVideoDevice(undefined, video.current, (result) => {
      if (result && mounted) {
        onScan(result.getText());
        setActive(false);
      }
    }).then((started) => {
      controls = started;
      if (!mounted) controls.stop();
    }).catch((reason: unknown) => {
      if (mounted) {
        setError(reason instanceof Error ? reason.message : "Could not access the camera.");
        setActive(false);
      }
    });
    return () => {
      mounted = false;
      controls?.stop();
    };
  }, [active, onScan]);

  return (
    <div className="stack">
      <button type="button" onClick={() => { setError(""); setActive((value) => !value); }}>
        {active ? "Stop camera" : "Scan QR with camera"}
      </button>
      {active && <video ref={video} className="scanner-video" muted playsInline />}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

export default function StaffPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [rawQr, setRawQr] = useState("");
  const [pickup, setPickup] = useState<QrPayload | null>(null);
  const [lines, setLines] = useState<{ item_id: number; quantity: number }[]>([]);
  const [lineHistory, setLineHistory] = useState<{ item_id: number; quantity: number }[][]>([]);
  const [manualItemId, setManualItemId] = useState("");
  const [verified, setVerified] = useState(false);
  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [selectedItem, setSelectedItem] = useState("");
  const [amount, setAmount] = useState("0");
  const [limitPerPerson, setLimitPerPerson] = useState("");
  const [pointsOverride, setPointsOverride] = useState("");
  const [available, setAvailable] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedLocation = locations.find((location) => location.id === locationId);

  useEffect(() => {
    Promise.all([
      api<Profile>("/account/me", {}, true),
      api<Location[]>("/locations"),
    ]).then(([current, allLocations]) => {
      setProfile(current);
      setLocations(allLocations);
      const location = current.location_id ?? allLocations[0]?.id ?? "";
      setLocationId(location);
      if (!["admin", "cashier", "stocker"].includes(current.role)) setError("Staff access is required.");
    }).catch((e: Error) => setError(e.message));
  }, []);

  const loadStaffData = useCallback(async () => {
    if (!locationId || !profile) return;
    try {
      const [catalog, inventory] = await Promise.all([
        api<Item[]>(`/items?location_id=${locationId}`),
        api<StockRow[]>(`/staff/locations/${locationId}/items`, {}, true),
      ]);
      setItems(catalog);
      setStock(inventory);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [locationId, profile]);

  useEffect(() => { loadStaffData(); }, [loadStaffData]);

  const onScan = useCallback((value: string) => {
    setRawQr(value);
    setError("");
    setMessage("");
    try {
      const decoded = parseQr(value);
      setPickup(decoded);
      setLines(decoded.lines);
      setLineHistory([]);
      setVerified(false);
      setPreview(null);
      if (decoded.location_id !== locationId) setError("This QR is for a different pantry location.");
    } catch (e) {
      setPickup(null);
      setError((e as Error).message);
    }
  }, [locationId]);

  useEffect(() => {
    if (!pickup || pickup.location_id !== locationId || !lines.length) return;
    api<CheckoutPreview>("/checkout/preview", {
      method: "POST",
      body: JSON.stringify({
        location_id: locationId,
        temple_id: pickup.temple_id,
        lines,
      }),
    }).then(setPreview).catch((e: Error) => setError(e.message));
  }, [pickup, locationId, lines]);

  const catalogOptions = useMemo(() => items.filter((item) => !stock.some((row) => row.item_id === item.id)), [items, stock]);

  function updateLines(next: { item_id: number; quantity: number }[]) {
    setLineHistory((history) => [...history, lines]);
    setLines(next);
  }

  async function submitQr(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onScan(rawQr);
  }

  async function completeCheckout() {
    if (!pickup || !verified || !preview?.eligible || !selectedLocation?.open_now) return;
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const result = await api<{ order_id: string; message: string }>("/cashier/checkout", {
        method: "POST",
        body: JSON.stringify({
          ...pickup,
          lines,
          temple_id_verified: verified,
        }),
      }, true);
      setMessage(`Checkout recorded. Order ${result.order_id}`);
      setPickup(null);
      setLines([]);
      setLineHistory([]);
      setPreview(null);
      setRawQr("");
      setVerified(false);
      await loadStaffData();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveStock(
    itemId: number,
    itemAmount: number,
    itemAvailable: boolean,
    itemLimit: number | null,
    itemPointsOverride: number | null,
  ) {
    if (!locationId) return;
    setError("");
    try {
      await api(`/staff/locations/${locationId}/items/${itemId}`, {
        method: "PUT",
        body: JSON.stringify({
          amount: itemAmount,
          available: itemAvailable,
          limit_per_person: itemLimit,
          points_cost_override: itemPointsOverride,
        }),
      }, true);
      setMessage("Inventory updated.");
      await loadStaffData();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function addInventory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!locationId || !selectedItem) return;
    setError("");
    try {
      await api(`/stocker/locations/${locationId}/items`, {
        method: "POST",
        body: JSON.stringify({
          item_id: Number(selectedItem),
          amount: Number(amount),
          available,
          limit_per_person: limitPerPerson === "" ? null : Number(limitPerPerson),
          points_cost_override: pointsOverride === "" ? null : Number(pointsOverride),
        }),
      }, true);
      setSelectedItem("");
      setAmount("0");
      setLimitPerPerson("");
      setPointsOverride("");
      setMessage("Item added to this pantry's inventory.");
      await loadStaffData();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!profile && !error) return <p>Loading staff tools…</p>;
  if (profile && !["admin", "cashier", "stocker"].includes(profile.role)) return <p className="error">{error}</p>;

  return (
    <div className="stack page-stack">
      <h1>Staff tools</h1>
      {profile && <p className="muted">Signed in as {profile.role}</p>}
      {profile?.role === "admin" && (
        <label className="stack">
          Location
          <select value={locationId} onChange={(event) => setLocationId(event.target.value)}>
            {locations.map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}
          </select>
        </label>
      )}
      {selectedLocation && <p className={selectedLocation.open_now ? "status-open" : "status-closed"}>{selectedLocation.status_message}</p>}

      {(profile?.role === "cashier" || profile?.role === "admin") && (
        <section className="staff-card">
          <h2>Cashier checkout</h2>
          <CameraScanner onScan={onScan} />
          <form className="stack" onSubmit={submitQr}>
            <label htmlFor="pickup-qr">Or paste a scanned pickup code</label>
            <textarea id="pickup-qr" value={rawQr} onChange={(event) => setRawQr(event.target.value)} />
            <button type="submit">Load pickup code</button>
          </form>
          {pickup && (
            <div className="stack">
              <p><strong>Temple ID:</strong> {pickup.temple_id}</p>
              <p><strong>Location:</strong> {pickup.location_id === locationId ? selectedLocation?.name : "Different location"}</p>
              {pickup.location_id === locationId && lines.map((line) => {
                const item = items.find((entry) => entry.id === line.item_id);
                return (
                  <div className="row" key={line.item_id}>
                    <span>{item?.name ?? `Item ${line.item_id}`} × {line.quantity}</span>
                    <div className="quantity-controls">
                      <button type="button" onClick={() => updateLines(lines.map((entry) =>
                        entry.item_id === line.item_id ? { ...entry, quantity: Math.max(0, entry.quantity - 1) } : entry,
                      ).filter((entry) => entry.quantity > 0))}>Drop one</button>
                      <button type="button" onClick={() => updateLines(lines.map((entry) =>
                        entry.item_id === line.item_id ? { ...entry, quantity: Math.min(99, entry.quantity + 1) } : entry,
                      ))}>Add one</button>
                    </div>
                  </div>
                );
              })}
              {pickup.location_id === locationId && (
                <div className="row-wrap">
                  <select value={manualItemId} onChange={(event) => setManualItemId(event.target.value)}>
                    <option value="">Add an item manually</option>
                    {items.filter((item) => item.location_stock?.available && item.location_stock.amount > 0)
                      .map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                  </select>
                  <button type="button" disabled={!manualItemId} onClick={() => {
                    const itemId = Number(manualItemId);
                    const existing = lines.find((line) => line.item_id === itemId);
                    updateLines(existing
                      ? lines.map((line) => line.item_id === itemId ? { ...line, quantity: Math.min(99, line.quantity + 1) } : line)
                      : [...lines, { item_id: itemId, quantity: 1 }]);
                    setManualItemId("");
                  }}>Add to pickup</button>
                  <button type="button" className="secondary-button" disabled={!lineHistory.length} onClick={() => {
                    const previous = lineHistory[lineHistory.length - 1];
                    setLineHistory((history) => history.slice(0, -1));
                    setLines(previous);
                  }}>Undo last change</button>
                </div>
              )}
              <label>
                <input type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} />
                I verified the person’s physical Temple ID.
              </label>
              {preview && (
                <div className="summary-card">
                  <p>{preview.total_points} points · {preview.remaining_points} remaining before this checkout</p>
                  {preview.errors.map((lineError) => <p className="error" key={lineError}>{lineError}</p>)}
                </div>
              )}
              {pickup.location_id !== locationId && <p className="error">This QR is for a different location and cannot be redeemed here.</p>}
              <button
                type="button"
                disabled={!verified || !preview?.eligible || !selectedLocation?.open_now || busy || pickup.location_id !== locationId}
                onClick={completeCheckout}
              >
                {busy ? "Completing…" : "Confirm pickup"}
              </button>
            </div>
          )}
        </section>
      )}

      {(profile?.role === "stocker" || profile?.role === "admin" || profile?.role === "cashier") && (
        <section className="staff-card">
          {(profile.role === "stocker" || profile.role === "admin") && (
            <>
              <h2>Add item to pantry inventory</h2>
              <form className="row-wrap" onSubmit={addInventory}>
                <select required value={selectedItem} onChange={(event) => setSelectedItem(event.target.value)}>
                  <option value="">Choose catalog item</option>
                  {catalogOptions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                </select>
                <label>Amount <input type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
                <label>Weekly limit <input type="number" min="0" value={limitPerPerson} onChange={(event) => setLimitPerPerson(event.target.value)} placeholder="No limit" /></label>
                <label>Points override <input type="number" min="0" value={pointsOverride} onChange={(event) => setPointsOverride(event.target.value)} placeholder="Use item cost" /></label>
                <label><input type="checkbox" checked={available} onChange={(event) => setAvailable(event.target.checked)} /> Available</label>
                <button type="submit">Add inventory</button>
              </form>
            </>
          )}
          <h2>Current stock and availability</h2>
          {stock.map((row) => (
            <div className="row inventory-row" key={row.item_id}>
              <span>{row.items.name}</span>
              <label>Amount <input aria-label={`${row.items.name} amount`} type="number" min="0" value={row.amount} onChange={(event) => setStock((current) => current.map((entry) => entry.item_id === row.item_id ? { ...entry, amount: Number(event.target.value) } : entry))} /></label>
              {(profile.role === "stocker" || profile.role === "admin") && (
                <>
                  <label>Weekly limit <input aria-label={`${row.items.name} weekly limit`} type="number" min="0" value={row.limit_per_person ?? ""} placeholder="No limit" onChange={(event) => setStock((current) => current.map((entry) => entry.item_id === row.item_id ? { ...entry, limit_per_person: event.target.value === "" ? null : Number(event.target.value) } : entry))} /></label>
                  <label>Points override <input aria-label={`${row.items.name} points override`} type="number" min="0" value={row.points_cost_override ?? ""} placeholder="Item default" onChange={(event) => setStock((current) => current.map((entry) => entry.item_id === row.item_id ? { ...entry, points_cost_override: event.target.value === "" ? null : Number(event.target.value) } : entry))} /></label>
                </>
              )}
              <label><input type="checkbox" checked={row.available} onChange={(event) => setStock((current) => current.map((entry) => entry.item_id === row.item_id ? { ...entry, available: event.target.checked } : entry))} /> Available</label>
              <button
                type="button"
                onClick={() => saveStock(
                  row.item_id,
                  row.amount,
                  row.available,
                  profile.role === "cashier" ? null : row.limit_per_person,
                  profile.role === "cashier" ? null : row.points_cost_override,
                )}
              >
                Save
              </button>
            </div>
          ))}
        </section>
      )}
      {message && <p role="status">{message}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
