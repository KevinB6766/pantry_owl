"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, Item, Location } from "@/lib/api";
import { getSelectedLocation, setSelectedLocation } from "@/lib/pantry";

export default function Home() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [tag, setTag] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [promotions, setPromotions] = useState<{
    new_items: Item[];
    frequently_bought_together: { items: Item[]; orders_together: number }[];
    notices: { id: string; title: string; body: string }[];
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<string[]>("/tags").then(setTags).catch((e) => setError(e.message));
    api<Location[]>("/locations").then((result) => {
      setLocations(result);
      if (!result.length) return;
      const saved = getSelectedLocation();
      const selected = result.find((location) => location.id === saved) ?? result[0];
      setLocationId(selected.id);
      setSelectedLocation(selected.id);
    }).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!locationId) return;
    const params = new URLSearchParams();
    if (tag) params.set("tag", tag);
    if (q) params.set("q", q);
    params.set("location_id", locationId);
    api<Item[]>(`/items?${params}`).then(setItems).catch((e) => setError(e.message));
  }, [tag, q, locationId]);

  useEffect(() => {
    if (!locationId) return;
    api<typeof promotions>(`/promotions?location_id=${locationId}`)
      .then(setPromotions)
      .catch((e) => setError(e.message));
  }, [locationId]);

  const location = locations.find((entry) => entry.id === locationId);

  return (
    <>
      <div className="row location-heading">
        <div>
          <h1>Pantry</h1>
          {location && <p className={location.open_now ? "status-open" : "muted"}>{location.status_message}</p>}
        </div>
        <Link href="/locations">Location details</Link>
      </div>
      {locations.length > 1 && (
        <label className="stack">
          Choose a pantry
          <select
            value={locationId}
            onChange={(event) => {
              setLocationId(event.target.value);
              setSelectedLocation(event.target.value);
            }}
          >
            {locations.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </select>
        </label>
      )}
      {!locations.length && <p className="muted">No pantry locations are available yet.</p>}
      {promotions?.notices.map((notice) => (
        <section className="notice" key={notice.id}>
          <strong>{notice.title}</strong>
          <p>{notice.body}</p>
        </section>
      ))}
      {location?.closures.map((closure) => (
        <section className="notice notice-urgent" key={closure.starts_at}>
          <strong>{closure.is_closed ? "Temporary closure" : "Special hours"}</strong>
          <p>{closure.message || (closure.is_closed ? "This pantry is temporarily closed." : "Special opening hours apply.")}</p>
        </section>
      ))}
      {promotions?.new_items.length ? (
        <section className="promotion">
          <h2>New at the pantry</h2>
          <div className="grid">
            {promotions.new_items.map((item) => (
              <Link className="card" href={`/items/${item.id}`} key={item.id}>
                {item.image_url && <img className="card-image" src={item.image_url} alt="" />}
                <strong>{item.name}</strong>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      {promotions?.frequently_bought_together.map((combo) => (
        <section className="promotion" key={combo.items.map((item) => item.id).join("-")}>
          <h2>Often picked together</h2>
          <p className="muted">Picked together {combo.orders_together} times</p>
          <div className="chips">
            {combo.items.map((item) => <Link key={item.id} href={`/items/${item.id}`}>{item.name}</Link>)}
          </div>
        </section>
      ))}
      <input placeholder="Search items…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">
        <button className={`chip ${tag === null ? "active" : ""}`} onClick={() => setTag(null)}>All</button>
        {tags.map((itemTag) => (
          <button key={itemTag} className={`chip ${tag === itemTag ? "active" : ""}`} onClick={() => setTag(itemTag)}>
            {itemTag}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <div className="grid">
        {items.map((i) => (
          <Link key={i.id} href={`/items/${i.id}`} className="card">
            {i.image_url && <img className="card-image" src={i.image_url} alt="" />}
            <strong>{i.name}</strong>
            <div className="muted">{i.tags.join(", ")}</div>
            {i.price != null && <div>${i.price.toFixed(2)}</div>}
            {i.location_stock ? (
              <div className={i.location_stock.available && i.location_stock.amount > 0 ? "status-open" : "status-closed"}>
                {i.location_stock.available && i.location_stock.amount > 0
                  ? `${i.location_stock.amount} available`
                  : "Out of stock"}
              </div>
            ) : <div className="muted">Not stocked here yet</div>}
          </Link>
        ))}
      </div>
    </>
  );
}
