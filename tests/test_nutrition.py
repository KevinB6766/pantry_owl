import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app import nutrition


@pytest.fixture(autouse=True)
def clear_nutrition_cache():
    nutrition._cache.clear()
    yield
    nutrition._cache.clear()


def test_barcode_lookup_uses_exact_usda_branded_match(monkeypatch):
    barcode = "078742256184"
    request = {}

    def fake_get(url, *, params, timeout):
        request.update(params)
        return SimpleNamespace(
            raise_for_status=lambda: None,
            json=lambda: {
                "foods": [
                    {
                        "gtinUpc": "000000000000",
                        "description": "Unrelated food",
                        "foodNutrients": [],
                    },
                    {
                        "gtinUpc": barcode,
                        "description": "Tomato sauce",
                        "servingSize": 63.0,
                        "servingSizeUnit": "g",
                        "foodNutrients": [
                            {
                                "nutrientName": "Energy",
                                "unitName": "KCAL",
                                "value": 40,
                            }
                        ],
                    },
                ]
            },
        )

    monkeypatch.setenv("USDA_API_KEY", "test-key")
    monkeypatch.setattr(nutrition.httpx, "get", fake_get)

    result = nutrition.get_nutrition(barcode)

    assert request["query"] == barcode
    assert request["dataType"] == "Branded"
    assert result == {
        "source": "USDA FoodData Central",
        "matched": "Tomato sauce",
        "per": "63.0 g",
        "nutrients": [{"name": "Calories", "amount": 40, "unit": "kcal"}],
    }


def test_barcode_lookup_does_not_return_nonmatching_search_results(monkeypatch):
    barcode = "622000856441"
    monkeypatch.setenv("USDA_API_KEY", "test-key")
    monkeypatch.setattr(
        nutrition.httpx,
        "get",
        lambda *args, **kwargs: SimpleNamespace(
            raise_for_status=lambda: None,
            json=lambda: {
                "foods": [
                    {
                        "gtinUpc": "000000000000",
                        "description": "Unrelated food",
                        "foodNutrients": [],
                    }
                ]
            },
        ),
    )

    assert nutrition.get_nutrition(barcode) is None


def test_text_lookup_remains_per_100_grams(monkeypatch):
    query = "brown rice raw"
    request = {}

    def fake_get(url, *, params, timeout):
        request.update(params)
        return SimpleNamespace(
            raise_for_status=lambda: None,
            json=lambda: {
                "foods": [
                    {
                        "description": "Brown rice, raw",
                        "foodNutrients": [],
                    }
                ]
            },
        )

    monkeypatch.setenv("USDA_API_KEY", "test-key")
    monkeypatch.setattr(nutrition.httpx, "get", fake_get)

    result = nutrition.get_nutrition(query)

    assert request["dataType"] == "Foundation,SR Legacy"
    assert result["per"] == "100 g"
