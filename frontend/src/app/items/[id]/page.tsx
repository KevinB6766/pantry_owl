"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, Item, Nutrition } from "@/lib/api";
import { getSelectedLocation, addSavedItem } from "@/lib/pantry";

export default function ItemPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [nutrition, setNutrition] = useState<Nutrition | null>(null);
  const [nutritionMissing, setNutritionMissing] = useState(false);
  const [message, setMessage] = useState("");
  const [locationId, setLocationId] = useState("");
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    const selected = getSelectedLocation();
    if (selected) setLocationId(selected);
    api<Nutrition>(`/items/${id}/nutrition`).then(setNutrition).catch(() => setNutritionMissing(true));
  }, [id]);

  useEffect(() => {
    const query = locationId ? `?location_id=${locationId}` : "";
    api<Item>(`/items/${id}${query}`).then(setItem).catch((e) => setMessage(e.message));
  }, [id, locationId]);

  if (!item) return <p>{message || "Loading…"}</p>;
  const images = [item.image_url, ...(item.extra_images ?? [])].filter((image): image is string => Boolean(image));
  const pointsCost = item.location_stock?.points_cost_override ?? item.points_cost;

  return (
    <>
      <Link href="/">← Back</Link>
      <h1>{item.name}</h1>
      {images.length > 0 && (
        <div className="item-gallery">
          <img src={images[imageIndex]} alt={item.name} />
          {images.length > 1 && (
            <div className="row">
              <button onClick={() => setImageIndex((imageIndex + images.length - 1) % images.length)}>Previous image</button>
              <span>{imageIndex + 1} / {images.length}</span>
              <button onClick={() => setImageIndex((imageIndex + 1) % images.length)}>Next image</button>
            </div>
          )}
        </div>
      )}
      {item.tags.length > 0 && <p className="muted">{item.tags.join(", ")}</p>}
      <p>{item.description}</p>
      {item.price != null && <p><strong>${item.price.toFixed(2)}</strong></p>}
      {pointsCost != null && <p><strong>{pointsCost} points</strong></p>}
      {item.weight && <p><strong>Package size:</strong> {item.weight}</p>}
      {item.location_stock ? (
        <p className={item.location_stock.available && item.location_stock.amount > 0 ? "status-open" : "status-closed"}>
          {item.location_stock.available && item.location_stock.amount > 0
            ? `${item.location_stock.amount} available`
            : "Currently out of stock"}
        </p>
      ) : <p className="muted">Not stocked at the selected location.</p>}
      <button
        onClick={() => {
          if (!locationId) return router.push("/locations");
          try {
            addSavedItem(locationId, item.id);
            setMessage("Added to your saved list.");
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Could not update your saved list.");
          }
        }}
        disabled={!item.location_stock?.available || item.location_stock.amount < 1}
      >
        Add to shopping list
      </button>
      {message && <p>{message}</p>}

      {item.nutrition_label_image_url && (
        <>
          <h2>Nutrition label</h2>
          <img className="nutrition-label" src={item.nutrition_label_image_url} alt={`${item.name} nutrition label`} />
        </>
      )}
      {item.ingredients && <><h2>Ingredients</h2><p>{item.ingredients}</p></>}
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
