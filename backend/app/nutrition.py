import os
import re
import httpx

USDA_URL = "https://api.nal.usda.gov/fdc/v1/foods/search"
UPC_PATTERN = re.compile(r"^[0-9]{12,13}$")

# (label, USDA nutrient name prefix, required unit or None)
WANTED = [
    ("Calories", "Energy", "KCAL"),
    ("Protein", "Protein", None),
    ("Total fat", "Total lipid", None),
    ("Carbohydrates", "Carbohydrate", None),
    ("Fiber", "Fiber", None),
    ("Sugars", "Sugars", None),
    ("Sodium", "Sodium", None),
]

_cache: dict[str, dict | None] = {}


def get_nutrition(query: str) -> dict | None:
    """Look up nutrition in USDA FoodData Central. Cached in memory."""
    if query in _cache:
        return _cache[query]

    is_upc = bool(UPC_PATTERN.fullmatch(query))
    params = {
        "api_key": os.environ["USDA_API_KEY"],
        "query": query,
        "dataType": "Branded" if is_upc else "Foundation,SR Legacy",
        "pageSize": 25 if is_upc else 1,
    }
    r = httpx.get(
        USDA_URL,
        params=params,
        timeout=15,
    )
    r.raise_for_status()
    foods = r.json().get("foods", [])

    if is_upc:
        padded_upc = f"0{query}" if len(query) == 12 else query
        food = next(
            (food for food in foods if str(food.get("gtinUpc", "")) in {query, padded_upc}),
            None,
        )
    else:
        food = foods[0] if foods else None

    if food is None:
        _cache[query] = None
        return None

    nutrients = []
    for label, prefix, unit in WANTED:
        for n in food.get("foodNutrients", []):
            if n.get("nutrientName", "").startswith(prefix) and (unit is None or n.get("unitName") == unit):
                nutrients.append({"name": label, "amount": n.get("value"), "unit": n.get("unitName", "").lower()})
                break

    if is_upc:
        size = food.get("servingSize")
        serving_unit = food.get("servingSizeUnit")
        per = f"{size} {serving_unit}".strip() if size is not None else "serving"
    else:
        per = "100 g"
    result = {
        "source": "USDA FoodData Central",
        "matched": food.get("description"),
        "per": per,
        "nutrients": nutrients,
    }
    _cache[query] = result
    return result
