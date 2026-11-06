import os
from pathlib import Path
import sys
from types import SimpleNamespace

import pytest
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

os.environ["SUPABASE_URL"] = "https://example.supabase.co"
os.environ["SUPABASE_SERVICE_KEY"] = "test-service-key"
os.environ["SUPABASE_ANON_KEY"] = "test-anon-key"

from app import main, security, workflows  # noqa: E402


LOCATION_ID = "00000000-0000-0000-0000-000000000001"
USER_ID = "00000000-0000-0000-0000-000000000002"
ORDER_ID = "00000000-0000-0000-0000-000000000003"

LOCATION = {
    "id": LOCATION_ID,
    "name": "Test Pantry",
    "timezone": "UTC",
    "weekly_points": 16,
    "week_start_day": 1,
}
ITEM = {
    "id": 1,
    "name": "Test Item",
    "nutrition_query": "Test Item",
    "points_cost": 2,
    "tags": ["fruit"],
}
PROFILE = {
    "id": USER_ID,
    "email": "admin@example.test",
    "role": "admin",
    "location_id": None,
}


class FakeQuery:
    def __init__(self, table_name):
        self.table_name = table_name
        self.selection = None
        self.filters = {}
        self.operation = "select"
        self.payload = None

    def select(self, columns):
        self.selection = columns
        return self

    def eq(self, column, value):
        self.filters[column] = value
        return self

    def __getattr__(self, name):
        if name in {"contains", "ilike", "in_", "gte", "gt", "lt", "lte", "order", "or_", "limit", "range"}:
            return lambda *args, **kwargs: self
        raise AttributeError(name)

    def insert(self, payload):
        self.operation = "insert"
        self.payload = payload
        return self

    def update(self, payload):
        self.operation = "update"
        self.payload = payload
        return self

    def upsert(self, payload, **kwargs):
        self.operation = "upsert"
        self.payload = payload
        return self

    def execute(self):
        if self.operation in {"insert", "update", "upsert"}:
            payloads = self.payload if isinstance(self.payload, list) else [self.payload]
            rows = [
                {"id": LOCATION_ID, **payload}
                for payload in payloads
            ]
            return SimpleNamespace(data=rows)

        if self.table_name == "locations":
            return SimpleNamespace(data=[LOCATION])
        if self.table_name == "location_hours":
            return SimpleNamespace(data=[])
        if self.table_name == "location_closures":
            return SimpleNamespace(data=[])
        if self.table_name == "splash_notices":
            return SimpleNamespace(data=[])
        if self.table_name == "items":
            if self.selection == "tags":
                return SimpleNamespace(data=[{"tags": ["fruit"]}])
            if self.selection == "name, nutrition_query":
                return SimpleNamespace(data=[ITEM])
            if self.selection == "id, name, points_cost":
                return SimpleNamespace(data=[ITEM])
            if self.filters.get("barcode"):
                return SimpleNamespace(data=[])
            if self.selection == "id":
                return SimpleNamespace(data=[{"id": 1}])
            return SimpleNamespace(data=[ITEM])
        if self.table_name == "location_items":
            if self.selection == "item_id, amount, available, limit_per_person, points_cost_override":
                return SimpleNamespace(
                    data=[
                        {
                            "item_id": 1,
                            "amount": 5,
                            "available": True,
                            "limit_per_person": None,
                            "points_cost_override": None,
                        }
                    ]
                )
            return SimpleNamespace(data=[])
        if self.table_name == "orders":
            return SimpleNamespace(data=[])
        if self.table_name == "order_items":
            return SimpleNamespace(data=[])
        if self.table_name == "profiles":
            if self.selection == "role":
                return SimpleNamespace(data=[{"role": "cashier"}])
            return SimpleNamespace(data=[PROFILE])
        return SimpleNamespace(data=[])


class FakeSupabase:
    def table(self, name):
        return FakeQuery(name)

    def rpc(self, name, params):
        return SimpleNamespace(execute=lambda: SimpleNamespace(data=ORDER_ID))


@pytest.fixture
def client(monkeypatch):
    fake_supabase = FakeSupabase()
    monkeypatch.setattr(main, "supabase", fake_supabase)
    monkeypatch.setattr(workflows, "supabase", fake_supabase)
    monkeypatch.setattr(main, "get_nutrition", lambda query: {"calories": 100})
    monkeypatch.setattr(
        main.httpx,
        "get",
        lambda *args, **kwargs: SimpleNamespace(
            raise_for_status=lambda: None,
            json=lambda: {
                "status": 1,
                "product": {"product_name": "Test Item", "brands": "Test Brand"},
            },
        ),
    )
    main.app.dependency_overrides[security.current_profile] = lambda: PROFILE
    with TestClient(main.app) as test_client:
        yield test_client
    main.app.dependency_overrides.clear()


ROUTE_CASES = [
    ("GET", "/health", None, None, 200),
    ("GET", "/admin/barcode/123456789012", None, None, 200),
    ("POST", "/admin/items", None, {
        "barcode": "123456789012",
        "name": "Test Item",
        "points_cost": 2,
    }, 201),
    ("GET", "/tags", None, None, 200),
    ("GET", "/items", None, None, 200),
    ("GET", "/items/1", None, None, 200),
    ("GET", "/items/1/nutrition", None, None, 200),
    ("GET", "/profile", None, None, 200),
    ("GET", "/locations", None, None, 200),
    ("GET", f"/locations/{LOCATION_ID}", None, None, 200),
    ("GET", "/account/me", None, None, 200),
    ("POST", "/checkout/preview", None, {
        "location_id": LOCATION_ID,
        "temple_id": "test-person",
        "lines": [{"item_id": 1, "quantity": 1}],
    }, 200),
    ("POST", "/cashier/checkout", None, {
        "location_id": LOCATION_ID,
        "temple_id": "test-person",
        "lines": [{"item_id": 1, "quantity": 1}],
        "qr_nonce": ORDER_ID,
        "temple_id_verified": True,
    }, 201),
    ("PUT", f"/staff/locations/{LOCATION_ID}/items/1", None, {
        "amount": 5,
    }, 200),
    ("POST", f"/stocker/locations/{LOCATION_ID}/items", None, {
        "item_id": 1,
        "amount": 5,
    }, 201),
    ("GET", f"/staff/locations/{LOCATION_ID}/items", None, None, 200),
    ("GET", f"/admin/locations/{LOCATION_ID}/dashboard", None, None, 200),
    ("GET", "/promotions", {"location_id": LOCATION_ID}, None, 200),
    ("POST", "/admin/notices", None, {
        "location_id": LOCATION_ID,
        "title": "Test notice",
        "body": "Test message",
    }, 201),
    ("POST", "/admin/locations", None, {
        "name": "Test Pantry",
        "timezone": "UTC",
    }, 201),
    ("POST", "/admin/closures", None, {
        "location_id": LOCATION_ID,
        "start_date": "2026-11-06",
        "end_date": "2026-11-06",
    }, 201),
    ("GET", "/admin/users", None, None, 200),
    ("PATCH", f"/admin/users/{USER_ID}", None, {
        "role": "user",
    }, 200),
    ("DELETE", f"/admin/users/{USER_ID}", None, None, 200),
]


def test_all_api_routes_have_smoke_cases():
    registered_routes = {
        (method, route.path)
        for route in main.app.routes
        if isinstance(route, APIRoute)
        for method in route.methods
    }
    covered_routes = {
        (method, route.replace(str(LOCATION_ID), "{location_id}")
         .replace(str(USER_ID), "{user_id}")
         .replace("/items/1", "/items/{item_id}")
         .replace("/123456789012", "/{barcode}"))
        for method, route, _, _, _ in ROUTE_CASES
    }
    assert registered_routes == covered_routes


@pytest.mark.parametrize(
    ("method", "path", "params", "payload", "expected_status"),
    ROUTE_CASES,
)
def test_route_smoke(client, method, path, params, payload, expected_status):
    response = client.request(method, path, params=params, json=payload)
    assert response.status_code == expected_status, response.text
