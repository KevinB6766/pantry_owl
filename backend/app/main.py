import os
import re
from typing import Optional
from uuid import UUID

import httpx
from postgrest.exceptions import APIError
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

from .db import supabase  # noqa: E402
from .nutrition import get_nutrition  # noqa: E402
from .security import current_profile, require_roles  # noqa: E402
from .workflows import router as workflow_router  # noqa: E402

app = FastAPI(title="Pantry Owl API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(workflow_router)


@app.get("/health")
def health():
    return {"ok": True}


def validate_barcode(barcode: str) -> str:
    if not re.fullmatch(r"[0-9]{12,13}", barcode):
        raise HTTPException(status_code=400, detail="Barcode must contain 12 or 13 digits")
    return barcode


@app.get("/admin/barcode/{barcode}")
def lookup_barcode(barcode: str, _: dict = Depends(require_roles("admin"))):
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
    tags: list[str] = Field(default_factory=list, max_length=30)
    points_cost: int = Field(ge=0)
    description: Optional[str] = Field(default=None, max_length=2000)
    ingredients: Optional[str] = Field(default=None, max_length=10000)
    weight: Optional[str] = Field(default=None, max_length=100)
    image_url: Optional[str] = Field(default=None, max_length=2000)
    nutrition_label_image_url: Optional[str] = Field(default=None, max_length=2000)
    extra_images: list[str] = Field(default_factory=list, max_length=20)
    nutrition_query: Optional[str] = Field(default=None, max_length=200)
    price: Optional[float] = Field(default=None, ge=0)


@app.post("/admin/items", status_code=201)
def create_admin_item(entry: AdminItemCreate, _: dict = Depends(require_roles("admin"))):
    duplicate = (
        supabase.table("items")
        .select("id")
        .eq("barcode", entry.barcode)
        .execute()
        .data
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="An item with this barcode already exists")

    item_data = entry.model_dump()
    item_data["tags"] = sorted({tag.strip().lower() for tag in entry.tags if tag.strip()})
    try:
        result = supabase.table("items").insert(item_data).execute()
    except APIError as exc:
        if getattr(exc, "code", None) == "23505":
            raise HTTPException(status_code=409, detail="An item with this barcode already exists") from exc
        raise HTTPException(status_code=502, detail="Could not save the item") from exc
    return result.data[0]


@app.get("/tags")
def tags():
    rows = supabase.table("items").select("tags").execute().data
    return sorted({tag for row in rows for tag in row.get("tags", [])})


@app.get("/items")
def items(tag: Optional[str] = None, q: Optional[str] = None, location_id: Optional[UUID] = None):
    query = supabase.table("items").select("*").order("name")
    if tag:
        query = query.contains("tags", [tag.strip().lower()])
    if q:
        query = query.ilike("name", f"%{q}%")
    result = query.execute().data
    if location_id is not None:
        stock_rows = (
            supabase.table("location_items")
            .select("item_id, amount, available, limit_per_person, points_cost_override")
            .eq("location_id", str(location_id))
            .execute()
            .data
        )
        stock = {row["item_id"]: row for row in stock_rows}
        for row in result:
            row["location_stock"] = stock.get(row["id"])
    return result


@app.get("/items/{item_id}")
def item(item_id: int, location_id: Optional[UUID] = None):
    res = supabase.table("items").select("*").eq("id", item_id).execute()
    if not res.data:
        raise HTTPException(404, "Item not found")
    row = res.data[0]
    if location_id is not None:
        stock = (
            supabase.table("location_items")
            .select("item_id, amount, available, limit_per_person, points_cost_override")
            .eq("location_id", str(location_id))
            .eq("item_id", item_id)
            .limit(1)
            .execute()
            .data
        )
        row["location_stock"] = stock[0] if stock else None
    return row


@app.get("/items/{item_id}/nutrition")
def item_nutrition(item_id: int):
    res = supabase.table("items").select("name, nutrition_query, barcode").eq("id", item_id).execute()
    if not res.data:
        raise HTTPException(404, "Item not found")
    row = res.data[0]
    data = get_nutrition(row["barcode"]) if row.get("barcode") else None
    if not data:
        data = get_nutrition(row["nutrition_query"] or row["name"])
    if not data:
        raise HTTPException(404, "No nutrition data found")
    return data


@app.get("/profile")
def get_profile(profile: dict = Depends(current_profile)):
    return profile
