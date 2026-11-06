import { supabase } from "./supabase";

export type Item = {
  id: number;
  name: string;
  description: string | null;
  price: number | null;
  image_url: string | null;
  tags: string[];
  weight?: string | null;
  ingredients?: string | null;
  nutrition_label_image_url?: string | null;
  extra_images?: string[];
  points_cost?: number | null;
  created_at?: string;
  location_stock?: {
    amount: number;
    available: boolean;
    limit_per_person: number | null;
    points_cost_override: number | null;
  } | null;
};
export type Nutrition = {
  source: string;
  matched: string;
  per: string;
  nutrients: { name: string; amount: number | null; unit: string }[];
};
export type LocationHour = { day_of_week: number; opens_at: string; closes_at: string };
export type Closure = {
  starts_at: string;
  ends_at: string;
  is_closed: boolean;
  opens_at: string | null;
  closes_at: string | null;
  message: string | null;
};
export type Location = {
  id: string;
  name: string;
  campus: string | null;
  building_room: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  directions_note: string | null;
  accessibility_note: string | null;
  phone: string | null;
  contact_email: string | null;
  photo_url: string | null;
  timezone: string;
  weekly_points: number;
  week_start_day: number;
  hours: LocationHour[];
  closures: Closure[];
  notices: { id: string; title: string; body: string }[];
  open_now: boolean;
  status_message: string;
};
export type CheckoutPreview = {
  eligible: boolean;
  errors: string[];
  total_points: number;
  points_spent: number;
  remaining_points: number;
  weekly_points: number;
  lines: {
    item_id: number;
    name: string;
    quantity: number;
    points_each: number | null;
    line_points: number;
    limit_per_person: number | null;
    remaining_item_limit: number | null;
  }[];
};

function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!configured) {
    throw new Error(
      "The backend URL is not configured. Set NEXT_PUBLIC_API_URL to the backend service URL and rebuild the frontend.",
    );
  }

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error(
      "NEXT_PUBLIC_API_URL must be an absolute backend URL, such as https://grocery-api.onrender.com.",
    );
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_API_URL must use HTTP or HTTPS.");
  }
  return configured.replace(/\/+$/, "");
}

export async function api<T>(path: string, init: RequestInit = {}, auth = false): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("Not signed in");
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  const res = await fetch(`${getApiBaseUrl()}${path}`, { ...init, headers: { ...headers, ...(init.headers as object) } });
  if (res.headers.get("content-type")?.includes("text/html")) {
    throw new Error(
      "The request reached a web page instead of the API. Check that NEXT_PUBLIC_API_URL points to the backend service, then rebuild and redeploy the frontend.",
    );
  }
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}
