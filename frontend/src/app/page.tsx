"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, Item, Location } from "@/lib/api";
import { addSavedItem, getSelectedLocation, setSelectedLocation } from "@/lib/pantry";

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
  const [loadingItems, setLoadingItems] = useState(false);
  const [toast, setToast] = useState("");

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
    if (q.trim()) params.set("q", q.trim());
    params.set("location_id", locationId);
    let active = true;
    setLoadingItems(true);
    api<Item[]>(`/items?${params}`)
      .then((result) => { if (active) setItems(result); })
      .catch((e) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoadingItems(false); });
    return () => { active = false; };
  }, [tag, q, locationId]);

  useEffect(() => {
    if (!locationId) return;
    api<typeof promotions>(`/promotions?location_id=${locationId}`)
      .then(setPromotions)
      .catch((e) => setError(e.message));
  }, [locationId]);

  const location = locations.find((entry) => entry.id === locationId);
  const stockedCount = items.filter((item) =>
    item.location_stock?.available && item.location_stock.amount > 0,
  ).length;

  function addToList(item: Item) {
    if (!locationId) return;
    try {
      addSavedItem(locationId, item.id);
      setToast(`${item.name} added to your list`);
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : "Could not update your list.");
    }
    window.setTimeout(() => setToast(""), 2400);
  }

  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Good food, shared locally</p>
          <h1>A little goodness goes a long way.</h1>
          <p>Browse what’s available at your neighborhood pantry and build a pickup list at your own pace.</p>
          {location && (
            <Link className="hero-location" href="/locations">
              <span aria-hidden="true">⌖</span>
              <span>{location.name} · {location.status_message}</span>
              <span aria-hidden="true">↗</span>
            </Link>
          )}
        </div>
        <div className="hero-art" aria-hidden="true">🧺</div>
      </section>

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
        <section className="home-section">
          <div className="section-heading">
            <div><p className="eyebrow">Just arrived</p><h2>New at the pantry</h2></div>
          </div>
          <div className="new-items-row">
            {promotions.new_items.map((item) => (
              <Link className="new-item-card" href={`/items/${item.id}`} key={item.id}>
                {item.image_url
                  ? <img src={item.image_url} alt="" />
                  : <div className="card-image-placeholder" aria-hidden="true">🥬</div>}
                <strong>{item.name}</strong>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {promotions?.frequently_bought_together.map((combo) => (
        <section className="promotion" key={combo.items.map((item) => item.id).join("-")}>
          <div className="section-heading">
            <div><p className="eyebrow">Community favorites</p><h2>Often picked together</h2></div>
          </div>
          <p className="muted">Picked together {combo.orders_together} times</p>
          <div className="chips">
            {combo.items.map((item) => <Link key={item.id} href={`/items/${item.id}`}>{item.name}</Link>)}
          </div>
        </section>
      ))}

      <section className="home-section" id="catalog">
        <div className="section-heading">
          <div><p className="eyebrow">Find your next favorite</p><h2>Pantry picks</h2></div>
          <Link href="/list">View your list →</Link>
        </div>
        <div className="catalog-toolbar">
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Search pantry items"
              placeholder="Search by item name…"
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </label>
          <span className="catalog-count">
            {loadingItems ? "Finding items…" : `${items.length} items · ${stockedCount} in stock`}
          </span>
        </div>
        <div className="chips" aria-label="Filter by category">
          <button className={`chip ${tag === null ? "active" : ""}`} onClick={() => setTag(null)}>Everything</button>
          {tags.map((itemTag) => (
            <button
              key={itemTag}
              className={`chip ${tag === itemTag ? "active" : ""}`}
              aria-pressed={tag === itemTag}
              onClick={() => setTag(itemTag)}
            >
              {itemTag.replaceAll("-", " ")}
            </button>
          ))}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        {loadingItems && items.length === 0 ? (
          <div className="empty-state" aria-live="polite"><p>Loading pantry picks…</p></div>
        ) : items.length ? (
          <div className="grid">
            {items.map((item) => {
              const inStock = Boolean(item.location_stock?.available && item.location_stock.amount > 0);
              const points = item.location_stock?.points_cost_override ?? item.points_cost;
              return (
                <article key={item.id} className="card">
                  <Link href={`/items/${item.id}`} aria-label={`View ${item.name}`}>
                    <div className="card-image-wrap">
                      {item.image_url
                        ? <img className="card-image" src={item.image_url} alt="" loading="lazy" />
                        : <span className="card-image-placeholder" aria-hidden="true">🥬</span>}
                      <span className={`stock-badge ${item.location_stock && !inStock ? "out" : ""}`}>
                        {item.location_stock ? (inStock ? `${item.location_stock.amount} available` : "Out of stock") : "Not stocked here yet"}
                      </span>
                    </div>
                  </Link>
                  <div className="card-body">
                    <Link href={`/items/${item.id}`} className="card-title">{item.name}</Link>
                    <div className="card-meta">
                      <span className="card-tags">{item.tags.slice(0, 2).join(" · ") || "Pantry staple"}</span>
                      <span>{points != null ? `${points} pts` : item.price != null ? `$${item.price.toFixed(2)}` : "Details"}</span>
                    </div>
                    <button className="card-action" disabled={!inStock} onClick={() => addToList(item)}>
                      {inStock ? "＋ Add to my list" : "View item"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <h3>No matching items yet</h3>
            <p>Try a different search or category, or check back as pantry stock changes.</p>
          </div>
        )}
      </section>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
