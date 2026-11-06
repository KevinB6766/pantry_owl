import { supabase } from "./supabase";

export type Item = {
  id: number;
  name: string;
  description: string | null;
  price: number | null;
  image_url: string | null;
  tags: string[];
};
export type Nutrition = {
  source: string;
  matched: string;
  per: string;
  nutrients: { name: string; amount: number | null; unit: string }[];
};
export type ListRow = { quantity: number; items: Item };

const API = process.env.NEXT_PUBLIC_API_URL!;

export async function api<T>(path: string, init: RequestInit = {}, auth = false): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("Not signed in");
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...headers, ...(init.headers as object) } });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}
