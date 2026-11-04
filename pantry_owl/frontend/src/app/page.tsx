"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, Category, Item } from "@/lib/api";

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<Category[]>("/categories").then(setCategories).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (q) params.set("q", q);
    api<Item[]>(`/items?${params}`).then(setItems).catch((e) => setError(e.message));
  }, [category, q]);

  return (
    <>
      <h1>Groceries</h1>
      <input placeholder="Search items…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">
        <button className={`chip ${category === null ? "active" : ""}`} onClick={() => setCategory(null)}>All</button>
        {categories.map((c) => (
          <button key={c.id} className={`chip ${category === c.slug ? "active" : ""}`} onClick={() => setCategory(c.slug)}>
            {c.name}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <div className="grid">
        {items.map((i) => (
          <Link key={i.id} href={`/items/${i.id}`} className="card">
            <strong>{i.name}</strong>
            <div className="muted">{i.categories?.name}</div>
            {i.price != null && <div>${i.price.toFixed(2)}</div>}
          </Link>
        ))}
      </div>
    </>
  );
}
