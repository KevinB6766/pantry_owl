"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ListRow } from "@/lib/api";
import { supabase } from "@/lib/supabase";

export default function ListPage() {
  const [rows, setRows] = useState<ListRow[] | null>(null);
  const [signedIn, setSignedIn] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return setSignedIn(false);
    setRows(await api<ListRow[]>("/list", {}, true));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function remove(itemId: number) {
    await api(`/list/${itemId}`, { method: "DELETE" }, true);
    load();
  }

  if (!signedIn) return <p><Link href="/login">Sign in</Link> to see your shopping list.</p>;
  if (!rows) return <p>Loading…</p>;

  return (
    <>
      <h1>My shopping list</h1>
      {rows.length === 0 && <p className="muted">Nothing here yet.</p>}
      {rows.map((r) => (
        <div className="row" key={r.items.id}>
          <Link href={`/items/${r.items.id}`}>{r.items.name} × {r.quantity}</Link>
          <button onClick={() => remove(r.items.id)}>Remove</button>
        </div>
      ))}
    </>
  );
}
