import os
from typing import Optional

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
