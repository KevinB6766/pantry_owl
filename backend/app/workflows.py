from collections import Counter, defaultdict
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from postgrest.exceptions import APIError

from .db import supabase
from .security import current_profile, require_location_access, require_roles

router = APIRouter()


def _location(location_id: str) -> dict:
    rows = (
        supabase.table("locations")
        .select("*")
        .eq("id", location_id)
        .eq("active", True)
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Location not found")
    return rows[0]


def _location_hours(location_id: str) -> list[dict]:
    return (
        supabase.table("location_hours")
        .select("day_of_week, opens_at, closes_at")
        .eq("location_id", location_id)
        .order("day_of_week")
        .order("opens_at")
        .execute()
        .data
    )


def _location_status(location: dict, hours: list[dict], closures: list[dict]) -> dict:
    try:
        local_now = datetime.now(ZoneInfo(location["timezone"]))
    except ZoneInfoNotFoundError as exc:
        raise HTTPException(status_code=500, detail="Location timezone is misconfigured") from exc

    active_closures = [
        row for row in closures
        if datetime.fromisoformat(row["starts_at"].replace("Z", "+00:00"))
        <= local_now.astimezone(timezone.utc)
        < datetime.fromisoformat(row["ends_at"].replace("Z", "+00:00"))
    ]
    closure = max(
        active_closures,
        key=lambda row: datetime.fromisoformat(row["starts_at"].replace("Z", "+00:00")),
        default=None,
    )
    if closure:
        if closure["is_closed"]:
            return {"open_now": False, "status_message": closure.get("message") or "Closed"}
        opens_at = time.fromisoformat(closure["opens_at"])
        closes_at = time.fromisoformat(closure["closes_at"])
        open_now = opens_at <= local_now.time().replace(tzinfo=None) < closes_at
        return {
            "open_now": open_now,
            "status_message": closure.get("message") or ("Open now" if open_now else "Closed"),
        }

    today_day = (local_now.weekday() + 1) % 7
    today_hours = [row for row in hours if row["day_of_week"] == today_day]
    open_now = any(
        time.fromisoformat(row["opens_at"]) <= local_now.time().replace(tzinfo=None)
        < time.fromisoformat(row["closes_at"])
        for row in today_hours
    )
    if open_now:
        return {"open_now": True, "status_message": "Open now"}
    next_window = next(
        (
            row for offset in range(7)
            for row in hours
            if row["day_of_week"] == (local_now.weekday() + 1 + offset) % 7
            and (
                offset > 0
                or time.fromisoformat(row["opens_at"]) > local_now.time().replace(tzinfo=None)
            )
        ),
        None,
    )
    return {
        "open_now": False,
        "status_message": f"Opens at {next_window['opens_at']}" if next_window else "No regular hours set",
    }


@router.get("/locations")
def locations():
    rows = supabase.table("locations").select("*").eq("active", True).order("name").execute().data
    result = []
    for location in rows:
        hours = _location_hours(location["id"])
        closures = (
            supabase.table("location_closures")
            .select("starts_at, ends_at, is_closed, opens_at, closes_at, message")
            .eq("location_id", location["id"])
            .gte("ends_at", datetime.now(timezone.utc).isoformat())
            .order("starts_at")
            .execute()
            .data
        )
        notices = (
            supabase.table("splash_notices")
            .select("id, title, body, starts_at, ends_at")
            .eq("location_id", location["id"])
            .eq("active", True)
            .lte("starts_at", datetime.now(timezone.utc).isoformat())
            .or_(f"ends_at.is.null,ends_at.gt.{datetime.now(timezone.utc).isoformat()}")
            .order("starts_at", desc=True)
            .execute()
            .data
        )
        location["hours"] = hours
        location["closures"] = closures
        location["notices"] = notices
        location.update(_location_status(location, hours, closures))
        result.append(location)
    return result


@router.get("/locations/{location_id}")
def location_details(location_id: UUID):
    location = _location(str(location_id))
    hours = _location_hours(str(location_id))
    closures = (
        supabase.table("location_closures")
        .select("starts_at, ends_at, is_closed, opens_at, closes_at, message")
        .eq("location_id", str(location_id))
        .gte("ends_at", datetime.now(timezone.utc).isoformat())
        .order("starts_at")
        .execute()
        .data
    )
    location["hours"] = hours
    location["closures"] = closures
    location.update(_location_status(location, hours, closures))
    return location


@router.get("/account/me")
def me(profile: dict = Depends(current_profile)):
    return profile


class LocationLine(BaseModel):
    item_id: int = Field(gt=0)
    quantity: int = Field(ge=1, le=99)


class CheckoutPreview(BaseModel):
    location_id: UUID
    temple_id: str = Field(min_length=1, max_length=128)
    lines: list[LocationLine] = Field(min_length=1, max_length=100)


def _preview(location_id: str, temple_id: str, lines: list[LocationLine]) -> dict:
    location = _location(location_id)
    temple_id = temple_id.strip()
    if not temple_id:
        raise HTTPException(status_code=422, detail="Temple ID is required")
    requested: dict[int, int] = defaultdict(int)
    for line in lines:
        requested[line.item_id] += line.quantity
    if any(quantity > 99 for quantity in requested.values()):
        raise HTTPException(status_code=422, detail="Combined item quantity cannot exceed 99")

    stock_rows = (
        supabase.table("location_items")
        .select("item_id, amount, available, limit_per_person, points_cost_override")
        .eq("location_id", location_id)
        .in_("item_id", list(requested))
        .execute()
        .data
    )
    stock = {row["item_id"]: row for row in stock_rows}
    item_rows = (
        supabase.table("items")
        .select("id, name, points_cost")
        .in_("id", list(requested))
        .execute()
        .data
    )
    items = {row["id"]: row for row in item_rows}
    missing = set(requested) - set(stock)
    if missing:
        raise HTTPException(status_code=409, detail="Some items are not stocked at this location")

    local_now = datetime.now(ZoneInfo(location["timezone"]))
    week_start = (
        local_now.date()
        - timedelta(days=(local_now.weekday() - (location["week_start_day"] - 1)) % 7)
    )
    week_start_utc = datetime.combine(
        week_start, time.min, tzinfo=ZoneInfo(location["timezone"])
    ).astimezone(timezone.utc).isoformat()
    next_week_utc = datetime.combine(
        week_start.fromordinal(week_start.toordinal() + 7),
        time.min,
        tzinfo=ZoneInfo(location["timezone"]),
    ).astimezone(timezone.utc).isoformat()
    previous_orders = (
        supabase.table("orders")
        .select("id, total_points")
        .eq("location_id", location_id)
        .eq("temple_id", temple_id)
        .gte("created_at", week_start_utc)
        .lt("created_at", next_week_utc)
        .execute()
        .data
    )
    points_spent = sum(row["total_points"] for row in previous_orders)
    prior_order_ids = [row["id"] for row in previous_orders]
    previous_quantities: dict[int, int] = defaultdict(int)
    if prior_order_ids:
        order_lines = (
            supabase.table("order_items")
            .select("item_id, quantity")
            .in_("order_id", prior_order_ids)
            .execute()
            .data
        )
        for row in order_lines:
            previous_quantities[row["item_id"]] += row["quantity"]

    details = []
    total_points = 0
    errors = []
    for item_id, quantity in requested.items():
        item = items.get(item_id)
        row = stock[item_id]
        if item is None:
            raise HTTPException(status_code=409, detail="An item no longer exists")
        points_each = row["points_cost_override"]
        if points_each is None:
            points_each = item["points_cost"]
        if not row["available"] or row["amount"] < quantity:
            errors.append(f"{item['name']} is unavailable or has insufficient stock")
        if points_each is None:
            errors.append(f"{item['name']} has no configured points cost")
        if row["limit_per_person"] is not None:
            remaining_limit = max(
                row["limit_per_person"] - previous_quantities[item_id], 0
            )
            if quantity > remaining_limit:
                errors.append(f"{item['name']} exceeds the weekly item limit")
        else:
            remaining_limit = None
        line_points = quantity * points_each if points_each is not None else 0
        total_points += line_points
        details.append(
            {
                "item_id": item_id,
                "name": item["name"],
                "quantity": quantity,
                "amount": row["amount"],
                "available": row["available"],
                "points_each": points_each,
                "line_points": line_points,
                "limit_per_person": row["limit_per_person"],
                "remaining_item_limit": remaining_limit,
            }
        )
    remaining_points = max(location["weekly_points"] - points_spent, 0)
    if total_points > remaining_points:
        errors.append("The list exceeds this week's remaining points")
    return {
        "location_id": location_id,
        "weekly_points": location["weekly_points"],
        "points_spent": points_spent,
        "remaining_points": remaining_points,
        "total_points": total_points,
        "lines": details,
        "eligible": not errors,
        "errors": errors,
    }


@router.post("/checkout/preview")
def checkout_preview(request: CheckoutPreview):
    return _preview(str(request.location_id), request.temple_id, request.lines)


class CheckoutRequest(CheckoutPreview):
    qr_nonce: UUID
    temple_id_verified: bool


@router.post("/cashier/checkout", status_code=201)
def cashier_checkout(
    request: CheckoutRequest,
    profile: dict = Depends(require_roles("cashier", "admin")),
):
    location_id = str(request.location_id)
    require_location_access(profile, location_id)
    if request.temple_id_verified is not True:
        raise HTTPException(status_code=400, detail="Verify the physical Temple ID before checkout")
    try:
        result = supabase.rpc(
            "checkout_order_verified",
            {
                "p_location_id": location_id,
                "p_temple_id": request.temple_id.strip(),
                "p_qr_nonce": str(request.qr_nonce),
                "p_cashier_id": profile["id"],
                "p_lines": [line.model_dump() for line in request.lines],
                "p_temple_id_verified": True,
            },
        ).execute()
    except APIError as exc:
        message = str(exc)
        status = 409 if any(
            term in message.lower()
            for term in ("closed", "stock", "limit", "points", "redeemed", "unavailable")
        ) else 400
        raise HTTPException(status_code=status, detail=message) from exc
    return {"order_id": result.data, "message": "Checkout completed"}


class StockUpdate(BaseModel):
    amount: int = Field(ge=0)
    available: bool = True
    limit_per_person: Optional[int] = Field(default=None, ge=0)
    points_cost_override: Optional[int] = Field(default=None, ge=0)


@router.put("/staff/locations/{location_id}/items/{item_id}")
def update_location_stock(
    location_id: UUID,
    item_id: int,
    update: StockUpdate,
    profile: dict = Depends(require_roles("stocker", "cashier", "admin")),
):
    location = str(location_id)
    require_location_access(profile, location)
    if profile["role"] == "cashier" and (
        update.limit_per_person is not None or update.points_cost_override is not None
    ):
        raise HTTPException(status_code=403, detail="Cashiers may update stock and availability only")
    current = (
        supabase.table("location_items")
        .select("limit_per_person, points_cost_override")
        .eq("location_id", location)
        .eq("item_id", item_id)
        .limit(1)
        .execute()
        .data
    )
    existing = current[0] if current else {}
    if profile["role"] == "cashier":
        limit_per_person = existing.get("limit_per_person")
        points_cost_override = existing.get("points_cost_override")
    else:
        limit_per_person = (
            update.limit_per_person
            if "limit_per_person" in update.model_fields_set
            else existing.get("limit_per_person")
        )
        points_cost_override = (
            update.points_cost_override
            if "points_cost_override" in update.model_fields_set
            else existing.get("points_cost_override")
        )
    item = supabase.table("items").select("id").eq("id", item_id).limit(1).execute().data
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    result = (
        supabase.table("location_items")
        .upsert(
            {
                "location_id": location,
                "item_id": item_id,
                "amount": update.amount,
                "available": update.available,
                "limit_per_person": limit_per_person,
                "points_cost_override": points_cost_override,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="location_id,item_id",
        )
        .execute()
    )
    return result.data[0]


class StockCreate(BaseModel):
    item_id: int = Field(gt=0)
    amount: int = Field(ge=0)
    available: bool = True
    limit_per_person: Optional[int] = Field(default=None, ge=0)
    points_cost_override: Optional[int] = Field(default=None, ge=0)


@router.post("/stocker/locations/{location_id}/items", status_code=201)
def add_location_item(
    location_id: UUID,
    entry: StockCreate,
    profile: dict = Depends(require_roles("stocker", "admin")),
):
    return update_location_stock(
        location_id,
        entry.item_id,
        StockUpdate(
            amount=entry.amount,
            available=entry.available,
            limit_per_person=entry.limit_per_person,
            points_cost_override=entry.points_cost_override,
        ),
        profile,
    )


@router.get("/staff/locations/{location_id}/items")
def staff_location_items(
    location_id: UUID,
    profile: dict = Depends(require_roles("stocker", "cashier", "admin")),
):
    location = str(location_id)
    require_location_access(profile, location)
    rows = (
        supabase.table("location_items")
        .select("*, items(*)")
        .eq("location_id", location)
        .order("item_id")
        .execute()
        .data
    )
    return rows


@router.get("/admin/locations/{location_id}/dashboard")
def admin_dashboard(
    location_id: UUID,
    profile: dict = Depends(require_roles("admin")),
):
    location = str(location_id)
    require_location_access(profile, location)
    stock_rows = (
        supabase.table("location_items")
        .select("item_id, amount, available, items(id, name, points_cost)")
        .eq("location_id", location)
        .execute()
        .data
    )
    orders = []
    offset = 0
    while True:
        batch = (
            supabase.table("orders")
            .select("id, total_points, created_at")
            .eq("location_id", location)
            .order("created_at", desc=True)
            .range(offset, offset + 999)
            .execute()
            .data
        )
        orders.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000
    order_ids = [order["id"] for order in orders]
    bought: Counter[int] = Counter()
    for order_start in range(0, len(order_ids), 200):
        order_batch = order_ids[order_start:order_start + 200]
        offset = 0
        while True:
            order_lines = (
                supabase.table("order_items")
                .select("item_id, quantity")
                .in_("order_id", order_batch)
                .range(offset, offset + 999)
                .execute()
                .data
            )
            for line in order_lines:
                bought[line["item_id"]] += line["quantity"]
            if len(order_lines) < 1000:
                break
            offset += 1000
    stock = []
    for row in stock_rows:
        item = row["items"]
        stock.append(
            {
                "item_id": row["item_id"],
                "name": item["name"],
                "amount_left": row["amount"],
                "available": row["available"],
                "bought": bought[row["item_id"]],
            }
        )
    return {
        "location_id": location,
        "orders": len(orders),
        "points_spent": sum(order["total_points"] for order in orders),
        "items": sorted(stock, key=lambda row: row["name"].lower()),
        "most_popular": sorted(stock, key=lambda row: row["bought"], reverse=True)[:10],
    }


@router.get("/promotions")
def promotions(location_id: UUID):
    location = str(location_id)
    _location(location)
    stocked_rows = (
        supabase.table("location_items")
        .select("item_id")
        .eq("location_id", location)
        .eq("available", True)
        .gt("amount", 0)
        .execute()
        .data
    )
    stocked_ids = [row["item_id"] for row in stocked_rows]
    new_since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    newest = (
        supabase.table("items")
        .select("id, name, description, image_url, tags, created_at")
        .in_("id", stocked_ids)
        .gte("created_at", new_since)
        .order("created_at", desc=True)
        .limit(6)
        .execute()
        .data
    ) if stocked_ids else []
    orders = []
    offset = 0
    while True:
        batch = (
            supabase.table("orders")
            .select("id")
            .eq("location_id", location)
            .order("created_at", desc=True)
            .range(offset, offset + 999)
            .execute()
            .data
        )
        orders.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000
    popular_pairs: Counter[tuple[int, int]] = Counter()
    if orders:
        by_order: dict[str, set[int]] = defaultdict(set)
        order_ids = [row["id"] for row in orders]
        for order_start in range(0, len(order_ids), 200):
            order_batch = order_ids[order_start:order_start + 200]
            offset = 0
            while True:
                lines = (
                    supabase.table("order_items")
                    .select("order_id, item_id")
                    .in_("order_id", order_batch)
                    .range(offset, offset + 999)
                    .execute()
                    .data
                )
                for line in lines:
                    by_order[line["order_id"]].add(line["item_id"])
                if len(lines) < 1000:
                    break
                offset += 1000
        for item_ids in by_order.values():
            ordered_ids = sorted(item_ids)
            for index, first in enumerate(ordered_ids):
                for second in ordered_ids[index + 1:]:
                    popular_pairs[(first, second)] += 1
    combos = []
    if popular_pairs:
        best_pair, count = popular_pairs.most_common(1)[0]
        pair = (
            supabase.table("items")
            .select("id, name, image_url")
            .in_("id", list(best_pair))
            .execute()
            .data
        )
        combos = [{"items": pair, "orders_together": count}]
    notices = (
        supabase.table("splash_notices")
        .select("id, title, body, starts_at, ends_at")
        .eq("location_id", location)
        .eq("active", True)
        .lte("starts_at", datetime.now(timezone.utc).isoformat())
        .or_(f"ends_at.is.null,ends_at.gt.{datetime.now(timezone.utc).isoformat()}")
        .order("starts_at", desc=True)
        .execute()
        .data
    )
    return {"new_items": newest, "frequently_bought_together": combos, "notices": notices}


class NoticeCreate(BaseModel):
    location_id: UUID
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=5000)
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


@router.post("/admin/notices", status_code=201)
def create_notice(
    entry: NoticeCreate,
    profile: dict = Depends(require_roles("admin")),
):
    if entry.ends_at and entry.starts_at and entry.ends_at <= entry.starts_at:
        raise HTTPException(status_code=422, detail="Notice end must be after its start")
    data = entry.model_dump()
    data["location_id"] = str(entry.location_id)
    data["created_by"] = profile["id"]
    if data["starts_at"] is not None:
        data["starts_at"] = data["starts_at"].isoformat()
    if data["ends_at"] is not None:
        data["ends_at"] = data["ends_at"].isoformat()
    return supabase.table("splash_notices").insert(data).execute().data[0]


class LocationHourInput(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    opens_at: time
    closes_at: time


class LocationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    campus: Optional[str] = Field(default=None, max_length=200)
    building_room: Optional[str] = Field(default=None, max_length=500)
    street_address: Optional[str] = Field(default=None, max_length=300)
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    postal_code: Optional[str] = Field(default=None, max_length=20)
    directions_note: Optional[str] = Field(default=None, max_length=2000)
    accessibility_note: Optional[str] = Field(default=None, max_length=2000)
    phone: Optional[str] = Field(default=None, max_length=50)
    contact_email: Optional[str] = Field(default=None, max_length=320)
    photo_url: Optional[str] = Field(default=None, max_length=2000)
    timezone: str = Field(min_length=1, max_length=100)
    weekly_points: int = Field(default=16, ge=0)
    week_start_day: int = Field(default=1, ge=0, le=6)
    hours: list[LocationHourInput] = Field(default_factory=list, max_length=42)


@router.post("/admin/locations", status_code=201)
def create_location(entry: LocationCreate, _: dict = Depends(require_roles("admin"))):
    try:
        ZoneInfo(entry.timezone)
    except ZoneInfoNotFoundError as exc:
        raise HTTPException(status_code=422, detail="Use a valid IANA timezone, such as America/New_York") from exc
    if any(hour.opens_at >= hour.closes_at for hour in entry.hours):
        raise HTTPException(status_code=422, detail="Each opening window must end after it starts")
    values = entry.model_dump(exclude={"hours"})
    location = supabase.table("locations").insert(values).execute().data[0]
    if entry.hours:
        supabase.table("location_hours").insert(
            [
                {
                    "location_id": location["id"],
                    "day_of_week": hour.day_of_week,
                    "opens_at": hour.opens_at.isoformat(),
                    "closes_at": hour.closes_at.isoformat(),
                }
                for hour in entry.hours
            ]
        ).execute()
    return location


class ClosureCreate(BaseModel):
    location_id: UUID
    start_date: date
    end_date: date
    is_closed: bool = True
    opens_at: Optional[time] = None
    closes_at: Optional[time] = None
    message: Optional[str] = Field(default=None, max_length=2000)


@router.post("/admin/closures", status_code=201)
def create_closure(
    entry: ClosureCreate,
    profile: dict = Depends(require_roles("admin")),
):
    if entry.end_date < entry.start_date:
        raise HTTPException(status_code=422, detail="Closure end date cannot be before its start date")
    location = _location(str(entry.location_id))
    try:
        zone = ZoneInfo(location["timezone"])
    except ZoneInfoNotFoundError as exc:
        raise HTTPException(status_code=500, detail="Location timezone is misconfigured") from exc
    starts_at = datetime.combine(entry.start_date, time.min, tzinfo=zone)
    ends_at = datetime.combine(entry.end_date + timedelta(days=1), time.min, tzinfo=zone)
    data = entry.model_dump()
    data["location_id"] = str(entry.location_id)
    data.pop("start_date")
    data.pop("end_date")
    data["starts_at"] = starts_at.isoformat()
    data["ends_at"] = ends_at.isoformat()
    for key in ("opens_at", "closes_at"):
        if data[key] is not None:
            data[key] = data[key].isoformat()
    if not entry.is_closed and (entry.opens_at is None or entry.closes_at is None):
        raise HTTPException(status_code=422, detail="Special hours require opening and closing times")
    if entry.is_closed and (entry.opens_at is not None or entry.closes_at is not None):
        raise HTTPException(status_code=422, detail="A full closure cannot also define special hours")
    if entry.opens_at is not None and entry.closes_at is not None and entry.opens_at >= entry.closes_at:
        raise HTTPException(status_code=422, detail="Special closing time must be after opening time")
    return supabase.table("location_closures").insert(data).execute().data[0]


class StaffRoleUpdate(BaseModel):
    role: str = Field(pattern=r"^(user|cashier|stocker|admin)$")
    location_id: Optional[UUID] = None


@router.get("/admin/users")
def admin_users(_: dict = Depends(require_roles("admin"))):
    return (
        supabase.table("profiles")
        .select("id, email, role, location_id, created_at")
        .order("created_at", desc=True)
        .execute()
        .data
    )


@router.patch("/admin/users/{user_id}")
def update_staff_role(
    user_id: UUID,
    update: StaffRoleUpdate,
    _: dict = Depends(require_roles("admin")),
):
    if update.role in ("cashier", "stocker") and update.location_id is None:
        raise HTTPException(status_code=422, detail="Cashiers and stockers must be assigned a location")
    if update.role in ("user", "admin") and update.location_id is not None:
        raise HTTPException(status_code=422, detail="Only cashiers and stockers have a location assignment")
    if update.location_id is not None:
        _location(str(update.location_id))
    result = (
        supabase.table("profiles")
        .update({"role": update.role, "location_id": str(update.location_id) if update.location_id else None})
        .eq("id", str(user_id))
        .execute()
        .data
    )
    if not result:
        raise HTTPException(status_code=404, detail="Profile not found")
    return result[0]


@router.delete("/admin/users/{user_id}")
def remove_cashier(
    user_id: UUID,
    _: dict = Depends(require_roles("admin")),
):
    profile = (
        supabase.table("profiles")
        .select("role")
        .eq("id", str(user_id))
        .limit(1)
        .execute()
        .data
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    if profile[0]["role"] != "cashier":
        raise HTTPException(status_code=409, detail="Only cashier accounts can be removed here")
    result = (
        supabase.table("profiles")
        .update({"role": "user", "location_id": None})
        .eq("id", str(user_id))
        .execute()
        .data
    )
    if not result:
        raise HTTPException(status_code=502, detail="Could not revoke cashier permissions")
    return {"demoted": str(user_id), "role": "user"}
