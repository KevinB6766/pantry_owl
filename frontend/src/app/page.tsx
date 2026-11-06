"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, Item } from "@/lib/api";

export default function Home() {
  const [tags, setTags] = useState<string[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [tag, setTag] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<string[]>("/tags").then(setTags).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (tag) params.set("tag", tag);
    if (q) params.set("q", q);
    api<Item[]>(`/items?${params}`).then(setItems).catch((e) => setError(e.message));
  }, [tag, q]);

  return (
    <>
      <h1>Pantry</h1>
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
            <strong>{i.name}</strong>
            <div className="muted">{i.tags.join(", ")}</div>
            {i.price != null && <div>${i.price.toFixed(2)}</div>}
          </Link>
        ))}
      </div>
    </>
  );
}
