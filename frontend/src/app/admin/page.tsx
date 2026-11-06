"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";

type BarcodeProduct = {
  barcode: string;
  name: string;
  description: string | null;
  ingredients: string | null;
  weight: string | null;
  image_url: string | null;
  nutrition_query: string;
};

type AdminItem = Omit<BarcodeProduct, "nutrition_query"> & {
  tags: string[];
  points_cost: number;
  nutrition_query: string | null;
  price: number | null;
};

export default function AdminPage() {
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<BarcodeProduct | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [weight, setWeight] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [nutritionQuery, setNutritionQuery] = useState("");
  const [tags, setTags] = useState("");
  const [pointsCost, setPointsCost] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setProduct(null);
    if (!/^\d{12,13}$/.test(barcode)) {
      setError("Enter a 12- or 13-digit barcode.");
      return;
    }

    setLoading(true);
    try {
      const result = await api<BarcodeProduct>(`/admin/barcode/${barcode}`, {}, true);
      setProduct(result);
      setName(result.name);
      setDescription(result.description ?? "");
      setIngredients(result.ingredients ?? "");
      setWeight(result.weight ?? "");
      setImageUrl(result.image_url ?? "");
      setNutritionQuery(result.nutrition_query);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!product) return;
    setError("");
    setNotice("");
    setSaving(true);
    try {
      await api("/admin/items", {
        method: "POST",
        body: JSON.stringify({
          barcode: product.barcode,
          name: name.trim(),
          tags: tags.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean),
          points_cost: Number(pointsCost),
          description: description.trim() || null,
          ingredients: ingredients.trim() || null,
          weight: weight.trim() || null,
          image_url: imageUrl.trim() || null,
          nutrition_query: nutritionQuery.trim() || null,
          price: price === "" ? null : Number(price),
        } satisfies AdminItem),
      }, true);
      setNotice(`${name.trim()} was added to the catalog.`);
      setBarcode("");
      setProduct(null);
      setTags("");
      setPointsCost("");
      setPrice("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack admin-tools">
      <h1>Admin tools</h1>
      <section>
        <h2>Add an item by barcode</h2>
        <p className="muted">Look up a UPC/EAN in Open Food Facts, review the details, then add it to the shared catalog.</p>
        <form className="stack" onSubmit={lookup}>
          <label htmlFor="barcode">12- or 13-digit barcode</label>
          <input
            id="barcode"
            inputMode="numeric"
            autoComplete="off"
            pattern="\d{12,13}"
            maxLength={13}
            required
            value={barcode}
            onChange={(event) => setBarcode(event.target.value.replace(/\D/g, "").slice(0, 13))}
          />
          <button type="submit" disabled={loading}>{loading ? "Looking up…" : "Look up barcode"}</button>
        </form>
      </section>

      {product && (
        <form className="stack admin-item-form" onSubmit={saveItem}>
          <h2>Review item details</h2>
          <p className="muted">Barcode: {product.barcode}. Product details can be edited before saving.</p>
          <label htmlFor="item-name">Item name</label>
          <input id="item-name" required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} />

          <label htmlFor="item-tags">Tags (comma separated)</label>
          <input id="item-tags" maxLength={500} value={tags} onChange={(event) => setTags(event.target.value)} />

          <label htmlFor="item-description">Description / brand</label>
          <textarea id="item-description" maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} />

          <label htmlFor="item-ingredients">Ingredients</label>
          <textarea id="item-ingredients" maxLength={10000} value={ingredients} onChange={(event) => setIngredients(event.target.value)} />

          <label htmlFor="item-weight">Weight or package size</label>
          <input id="item-weight" maxLength={100} value={weight} onChange={(event) => setWeight(event.target.value)} />

          <label htmlFor="item-image">Image URL</label>
          <input id="item-image" type="url" maxLength={2000} value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} />

          <label htmlFor="nutrition-query">USDA nutrition search name</label>
          <input id="nutrition-query" maxLength={200} value={nutritionQuery} onChange={(event) => setNutritionQuery(event.target.value)} />

          <label htmlFor="item-points-cost">Points cost per item</label>
          <input id="item-points-cost" type="number" min="0" step="1" required value={pointsCost} onChange={(event) => setPointsCost(event.target.value)} />

          <label htmlFor="item-price">Price (optional)</label>
          <input id="item-price" type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} />
          <button type="submit" disabled={saving}>
            {saving ? "Adding item…" : "Add item to catalog"}
          </button>
        </form>
      )}

      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
