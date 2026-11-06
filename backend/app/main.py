import os
import re
from typing import Optional

import httpx
from postgrest.exceptions import APIError
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

from .auth import current_user_id  # noqa: E402
from .db import supabase  # noqa: E402
from .nutrition import get_nutrition  # noqa: E402

app = FastAPI(title="Pantry Owl API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


def require_admin(user_id: str = Depends(current_user_id)) -> str:
    profile = (
        supabase.table("profiles")
        .select("role")
        .eq("id", user_id)
        .execute()
        .data
    )
    if not profile or profile[0]["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user_id


def validate_barcode(barcode: str) -> str:
    if not re.fullmatch(r"[0-9]{12,13}", barcode):
        raise HTTPException(status_code=400, detail="Barcode must contain 12 or 13 digits")
    return barcode


@app.get("/admin/barcode/{barcode}")
def lookup_barcode(barcode: str, _: str = Depends(require_admin)):
    validate_barcode(barcode)
    try:
        response = httpx.get(
            f"https://world.openfoodfacts.org/api/v2/product/{barcode}.json",
            params={"fields": "code,product_name,product_name_en,brands,ingredients_text,quantity,image_front_url"},
            headers={"User-Agent": "PantryOwl/1.0"},
            timeout=10,
        )
        response.raise_for_status()
        result = response.json()
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="Open Food Facts lookup timed out") from exc
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Open Food Facts lookup failed") from exc

    product = result.get("product") if isinstance(result, dict) else None
    if not isinstance(product, dict) or result.get("status") != 1:
        raise HTTPException(status_code=404, detail="No product was found for this barcode")

    name = product.get("product_name_en") or product.get("product_name")
    if not isinstance(name, str) or not name.strip():
        raise HTTPException(status_code=422, detail="The product has no name in Open Food Facts")

    brands = product.get("brands")
    return {
        "barcode": barcode,
        "name": name.strip(),
        "description": f"Brand: {brands.strip()}" if isinstance(brands, str) and brands.strip() else None,
        "ingredients": product.get("ingredients_text") or None,
        "weight": product.get("quantity") or None,
        "image_url": product.get("image_front_url") or None,
        "nutrition_query": name.strip(),
    }


class AdminItemCreate(BaseModel):
    barcode: str = Field(pattern=r"^[0-9]{12,13}$")
    name: str = Field(min_length=1, max_length=200)
    category_id: int = Field(gt=0)
    description: Optional[str] = Field(default=None, max_length=2000)
    ingredients: Optional[str] = Field(default=None, max_length=10000)
    weight: Optional[str] = Field(default=None, max_length=100)
    image_url: Optional[str] = Field(default=None, max_length=2000)
    nutrition_query: Optional[str] = Field(default=None, max_length=200)
    price: Optional[float] = Field(default=None, ge=0)


@app.post("/admin/items", status_code=201)
def create_admin_item(entry: AdminItemCreate, _: str = Depends(require_admin)):
    duplicate = (
        supabase.table("items")
        .select("id")
        .eq("barcode", entry.barcode)
        .execute()
        .data
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="An item with this barcode already exists")

    try:
        result = supabase.table("items").insert(entry.model_dump()).execute()
    except APIError as exc:
        if getattr(exc, "code", None) == "23505":
            raise HTTPException(status_code=409, detail="An item with this barcode already exists") from exc
        raise HTTPException(status_code=502, detail="Could not save the item") from exc
    return result.data[0]


@app.get("/categories")
def categories():
    return supabase.table("categories").select("*").order("name").execute().data


@app.get("/items")
def items(category: Optional[str] = None, q: Optional[str] = None):
    select = "*, categories!inner(name, slug)" if category else "*, categories(name, slug)"
    query = supabase.table("items").select(select).order("name")
    if category:
        query = query.eq("categories.slug", category)
    if q:
        query = query.ilike("name", f"%{q}%")
    return query.execute().data


@app.get("/items/{item_id}")
def item(item_id: int):
    res = supabase.table("items").select("*, categories(name, slug)").eq("id", item_id).execute()
    if not res.data:
        raise HTTPException(404, "Item not found")
    return res.data[0]


@app.get("/items/{item_id}/nutrition")
def item_nutrition(item_id: int):
    res = supabase.table("items").select("name, nutrition_query").eq("id", item_id).execute()
    if not res.data:
        raise HTTPException(404, "Item not found")
    row = res.data[0]
    data = get_nutrition(row["nutrition_query"] or row["name"])
    if not data:
        raise HTTPException(404, "No nutrition data found")
    return data


class ListEntry(BaseModel):
    item_id: int
    quantity: int = Field(default=1, ge=1, le=99)


@app.get("/list")
def get_list(user_id: str = Depends(current_user_id)):
    return (
        supabase.table("shopping_list")
        .select("quantity, items(*)")
        .eq("user_id", user_id)
        .execute()
        .data
    )


@app.post("/list")
def add_to_list(entry: ListEntry, user_id: str = Depends(current_user_id)):
    existing = (
        supabase.table("shopping_list")
        .select("quantity")
        .eq("user_id", user_id)
        .eq("item_id", entry.item_id)
        .execute()
        .data
    )
    qty = min((existing[0]["quantity"] if existing else 0) + entry.quantity, 99)
    supabase.table("shopping_list").upsert(
        {"user_id": user_id, "item_id": entry.item_id, "quantity": qty},
        on_conflict="user_id,item_id",
    ).execute()
    return {"item_id": entry.item_id, "quantity": qty}


@app.delete("/list/{item_id}")
def remove_from_list(item_id: int, user_id: str = Depends(current_user_id)):
    supabase.table("shopping_list").delete().eq("user_id", user_id).eq("item_id", item_id).execute()
    return {"deleted": item_id}
