"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, Item, Nutrition } from "@/lib/api";
import { supabase } from "@/lib/supabase";

export default function ItemPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [nutrition, setNutrition] = useState<Nutrition | null>(null);
  const [nutritionMissing, setNutritionMissing] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api<Item>(`/items/${id}`).then(setItem).catch((e) => setMessage(e.message));
    api<Nutrition>(`/items/${id}/nutrition`).then(setNutrition).catch(() => setNutritionMissing(true));
  }, [id]);

  async function addToList() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return router.push("/login");
    try {
      await api("/list", { method: "POST", body: JSON.stringify({ item_id: Number(id), quantity: 1 }) }, true);
      setMessage("Added to your shopping list ✓");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  if (!item) return <p>{message || "Loading…"}</p>;

  return (
    <>
      <Link href="/">← Back</Link>
      <h1>{item.name}</h1>
      {item.tags.length > 0 && <p className="muted">{item.tags.join(", ")}</p>}
      <p>{item.description}</p>
      {item.price != null && <p><strong>${item.price.toFixed(2)}</strong></p>}
      <button onClick={addToList}>Add to shopping list</button>
      {message && <p>{message}</p>}

      <h2>Nutrition facts</h2>
      {nutrition ? (
        <>
          <p className="muted">Per {nutrition.per} · matched “{nutrition.matched}” · {nutrition.source}</p>
          <table>
            <tbody>
              {nutrition.nutrients.map((n) => (
                <tr key={n.name}>
                  <td>{n.name}</td>
                  <td>{n.amount} {n.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="muted">{nutritionMissing ? "No nutrition data available." : "Loading…"}</p>
      )}
    </>
  );
}
