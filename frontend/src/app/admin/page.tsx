"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, Location } from "@/lib/api";

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
  nutrition_label_image_url: string | null;
  extra_images: string[];
  nutrition_query: string | null;
};

type AdminUser = { id: string; email: string | null; role: string; location_id: string | null };
type Dashboard = {
  orders: number;
  points_spent: number;
  items: { item_id: number; name: string; amount_left: number; available: boolean; bought: number }[];
  most_popular: { item_id: number; name: string; amount_left: number; available: boolean; bought: number }[];
};

export default function AdminPage() {
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<BarcodeProduct | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [weight, setWeight] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [nutritionLabelUrl, setNutritionLabelUrl] = useState("");
  const [extraImages, setExtraImages] = useState("");
  const [nutritionQuery, setNutritionQuery] = useState("");
  const [tags, setTags] = useState("");
  const [pointsCost, setPointsCost] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeBody, setNoticeBody] = useState("");
  const [closureStart, setClosureStart] = useState("");
  const [closureEnd, setClosureEnd] = useState("");
  const [closureMessage, setClosureMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    api<{ role: string }>("/account/me", {}, true)
      .then(async (profile) => {
        if (profile.role !== "admin") throw new Error("Admin access required");
        const [locationRows, userRows] = await Promise.all([
          api<Location[]>("/locations"),
          api<AdminUser[]>("/admin/users", {}, true),
        ]);
        setLocations(locationRows);
        setUsers(userRows);
        if (locationRows[0]) setLocationId(locationRows[0].id);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!locationId) return;
    api<Dashboard>(`/admin/locations/${locationId}/dashboard`, {}, true)
      .then(setDashboard)
      .catch((e: Error) => setError(e.message));
  }, [locationId]);

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
          nutrition_label_image_url: nutritionLabelUrl.trim() || null,
          extra_images: extraImages.split(",").map((image) => image.trim()).filter(Boolean),
        } satisfies AdminItem),
      }, true);
      setNotice(`${name.trim()} was added to the catalog.`);
      setBarcode("");
      setProduct(null);
      setTags("");
      setPointsCost("");
      setNutritionLabelUrl("");
      setExtraImages("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function saveUser(user: AdminUser) {
    setError("");
    try {
      await api(`/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role: user.role, location_id: user.location_id }),
      }, true);
      setNotice(`Updated access for ${user.email ?? user.id}.`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function removeCashier(user: AdminUser) {
    setError("");
    try {
      await api(`/admin/users/${user.id}`, { method: "DELETE" }, true);
      setUsers((current) => current.map((entry) => entry.id === user.id ? { ...entry, role: "user", location_id: null } : entry));
      setNotice(`${user.email ?? "Cashier"} can no longer use staff tools.`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function createNotice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!locationId) return;
    try {
      await api("/admin/notices", {
        method: "POST",
        body: JSON.stringify({ location_id: locationId, title: noticeTitle, body: noticeBody }),
      }, true);
      setNoticeTitle("");
      setNoticeBody("");
      setNotice("Notice published.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function createClosure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!locationId) return;
    try {
      await api("/admin/closures", {
        method: "POST",
        body: JSON.stringify({
          location_id: locationId,
          start_date: closureStart,
          end_date: closureEnd,
          is_closed: true,
          message: closureMessage || null,
        }),
      }, true);
      setClosureStart("");
      setClosureEnd("");
      setClosureMessage("");
      setNotice("Closure published.");
    } catch (e) {
      setError((e as Error).message);
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

          <label htmlFor="nutrition-label-image">Nutrition label image URL</label>
          <input id="nutrition-label-image" type="url" maxLength={2000} value={nutritionLabelUrl} onChange={(event) => setNutritionLabelUrl(event.target.value)} />

          <label htmlFor="item-extra-images">Additional image URLs (comma separated)</label>
          <textarea id="item-extra-images" maxLength={10000} value={extraImages} onChange={(event) => setExtraImages(event.target.value)} />

          <label htmlFor="nutrition-query">USDA nutrition search name</label>
          <input id="nutrition-query" maxLength={200} value={nutritionQuery} onChange={(event) => setNutritionQuery(event.target.value)} />

          <label htmlFor="item-points-cost">Points cost per item</label>
          <input id="item-points-cost" type="number" min="0" step="1" required value={pointsCost} onChange={(event) => setPointsCost(event.target.value)} />

          <button type="submit" disabled={saving}>
            {saving ? "Adding item…" : "Add item to catalog"}
          </button>
        </form>
      )}

      <section className="admin-section">
        <h2>Location dashboard</h2>
        <label className="stack">
          Location
          <select value={locationId} onChange={(event) => setLocationId(event.target.value)}>
            {locations.map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}
          </select>
        </label>
        {dashboard && (
          <>
            <p>{dashboard.orders} checkouts · {dashboard.points_spent} points redeemed</p>
            <h3>Items left</h3>
            <div className="table-scroll">
              <table><thead><tr><th>Item</th><th>Stock</th><th>Availability</th><th>Bought</th></tr></thead>
                <tbody>{dashboard.items.map((row) => <tr key={row.item_id}><td>{row.name}</td><td>{row.amount_left}</td><td>{row.available ? "Available" : "Unavailable"}</td><td>{row.bought}</td></tr>)}</tbody>
              </table>
            </div>
            <h3>Most popular</h3>
            <ol>{dashboard.most_popular.map((row) => <li key={row.item_id}>{row.name}: {row.bought} bought</li>)}</ol>
          </>
        )}
      </section>

      <section className="admin-section">
        <h2>Account access</h2>
        {users.map((user) => (
          <div className="account-row" key={user.id}>
            <strong>{user.email ?? user.id}</strong>
            <select
              aria-label={`Role for ${user.email ?? user.id}`}
              value={user.role}
              onChange={(event) => setUsers((current) => current.map((entry) => entry.id === user.id
                ? { ...entry, role: event.target.value, location_id: ["cashier", "stocker"].includes(event.target.value) ? entry.location_id ?? locationId : null }
                : entry))}
            >
              {["user", "cashier", "stocker", "admin"].map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
            {["cashier", "stocker"].includes(user.role) && (
              <select
                aria-label={`Location for ${user.email ?? user.id}`}
                value={user.location_id ?? ""}
                onChange={(event) => setUsers((current) => current.map((entry) => entry.id === user.id ? { ...entry, location_id: event.target.value } : entry))}
              >
                <option value="">Choose location</option>
                {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
              </select>
            )}
            <button type="button" onClick={() => saveUser(user)}>Save role</button>
            {user.role === "cashier" && <button className="secondary-button" type="button" onClick={() => removeCashier(user)}>Remove cashier access</button>}
          </div>
        ))}
      </section>

      <section className="admin-section">
        <h2>Location notices and closures</h2>
        <form className="stack" onSubmit={createNotice}>
          <h3>Publish a notice</h3>
          <input required maxLength={200} placeholder="Notice title" value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} />
          <textarea required maxLength={5000} placeholder="Notice details" value={noticeBody} onChange={(event) => setNoticeBody(event.target.value)} />
          <button type="submit" disabled={!locationId}>Publish notice</button>
        </form>
        <form className="stack" onSubmit={createClosure}>
          <h3>Schedule a closure</h3>
          <label>First closed day <input type="date" required value={closureStart} onChange={(event) => setClosureStart(event.target.value)} /></label>
          <label>Last closed day <input type="date" required value={closureEnd} onChange={(event) => setClosureEnd(event.target.value)} /></label>
          <textarea maxLength={2000} placeholder="Message for visitors" value={closureMessage} onChange={(event) => setClosureMessage(event.target.value)} />
          <button type="submit" disabled={!locationId}>Schedule closure</button>
        </form>
      </section>

      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
