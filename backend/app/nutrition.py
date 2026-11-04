import os
import httpx

USDA_URL = "https://api.nal.usda.gov/fdc/v1/foods/search"

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
    """Look up nutrition (per 100 g) in USDA FoodData Central. Cached in memory."""
    if query in _cache:
        return _cache[query]

    r = httpx.get(
        USDA_URL,
        params={
            "api_key": os.environ["USDA_API_KEY"],
            "query": query,
            "dataType": "Foundation,SR Legacy",
            "pageSize": 1,
        },
        timeout=15,
    )
    r.raise_for_status()
    foods = r.json().get("foods", [])
    if not foods:
        _cache[query] = None
        return None

    food = foods[0]
    nutrients = []
    for label, prefix, unit in WANTED:
        for n in food.get("foodNutrients", []):
            if n.get("nutrientName", "").startswith(prefix) and (unit is None or n.get("unitName") == unit):
                nutrients.append({"name": label, "amount": n.get("value"), "unit": n.get("unitName", "").lower()})
                break

    result = {"source": "USDA FoodData Central", "matched": food.get("description"), "per": "100 g", "nutrients": nutrients}
    _cache[query] = result
    return result
