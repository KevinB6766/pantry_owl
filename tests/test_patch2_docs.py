"""Tests for patch 2: project docs, business rules, and per-location model.

Patch 2 changes documentation only (PROJECT.md, DELIVERABLES.md, CURRENT_STATE.md),
so these tests check that the docs are complete, consistent with each other, and
free of stale statements from before the rules were decided.

Run from the repo root:
    pip install pytest
    pytest tests/test_patch2_docs.py -v

Set PANTRY_DOCS_ROOT to point the tests at a different folder of docs.
"""
import os
import re
from datetime import date
from pathlib import Path

import pytest

ROOT = Path(os.environ.get("PANTRY_DOCS_ROOT", Path(__file__).resolve().parent.parent))
DELIVERABLE_IDS = [f"D{i}" for i in range(1, 12)]


def read(name: str) -> str:
    return (ROOT / name).read_text(encoding="utf-8")


def section(text: str, heading: str) -> str:
    """Return the text under `heading` up to the next heading of the same or higher level."""
    m = re.search(rf"^(#+) {re.escape(heading)}[^\n]*$", text, re.M)
    assert m, f"heading not found: {heading!r}"
    level = len(m.group(1))
    rest = text[m.end():]
    nxt = re.search(rf"^#{{1,{level}}} ", rest, re.M)
    return rest[: nxt.start()] if nxt else rest


@pytest.fixture(scope="module")
def project():
    return read("PROJECT.md")


@pytest.fixture(scope="module")
def deliverables():
    return read("DELIVERABLES.md")


@pytest.fixture(scope="module")
def state():
    return read("CURRENT_STATE.md")


# ---------- structure ----------

def test_all_three_docs_exist():
    for name in ("PROJECT.md", "DELIVERABLES.md", "CURRENT_STATE.md"):
        assert (ROOT / name).is_file(), f"{name} is missing"


def test_readme_links_to_the_docs():
    readme = read("README.md")
    for name in ("PROJECT.md", "DELIVERABLES.md", "CURRENT_STATE.md"):
        assert name in readme, f"README does not link {name}"


def test_relative_links_resolve():
    for doc in ("PROJECT.md", "DELIVERABLES.md", "CURRENT_STATE.md", "README.md"):
        for target in re.findall(r"\]\(([^)#]+)\)", read(doc)):
            if target.startswith(("http://", "https://", "mailto:")):
                continue
            assert (ROOT / target).exists(), f"{doc} links to missing file {target}"


def test_every_deliverable_is_in_deliverables_and_state(deliverables, state):
    for d in DELIVERABLE_IDS:
        assert re.search(rf"^## {d}\.", deliverables, re.M), f"{d} missing from DELIVERABLES.md"
        assert re.search(rf"^### {d}\.", state, re.M), f"{d} missing from CURRENT_STATE.md"


def test_current_state_has_required_sections(state):
    for heading in ("How to use this file", "Decisions Made", "Decisions Pending", "Next Up", "Session Log"):
        assert re.search(rf"^## {heading}", state, re.M), f"CURRENT_STATE.md lacks '{heading}'"


def test_checkbox_syntax_is_valid(deliverables):
    # Valid marks are [ ], [~], [x]. The original spec used "[  ]" (two spaces), which is not valid.
    for line in deliverables.splitlines():
        if re.match(r"^\s*- \[", line):
            assert re.match(r"^\s*- \[( |~|x)\] \S", line), f"malformed checkbox: {line!r}"
        assert "[  ]" not in line, f"two-space checkbox found: {line!r}"


def test_state_dates_are_valid(state):
    m = re.search(r"\*\*Last updated:\*\* (\d{4}-\d{2}-\d{2})", state)
    assert m, "CURRENT_STATE.md has no 'Last updated' date"
    date.fromisoformat(m.group(1))
    log = section(state, "Session Log")
    entries = [l for l in log.splitlines() if l.strip()]
    assert entries, "Session Log is empty"
    for line in entries:
        dm = re.match(r"^- (\d{4}-\d{2}-\d{2}): \S", line)
        assert dm, f"bad session log line: {line!r}"
        date.fromisoformat(dm.group(1))


# ---------- D1 consistency ----------

def test_d1_status_agrees_across_files(deliverables, state):
    d1_del = section(deliverables, "D1.")
    d1_state = section(state, "D1.")
    assert "DONE" in deliverables[deliverables.index("## D1."):].splitlines()[0]
    assert "DONE" in state[state.index("### D1."):].splitlines()[0]
    items = re.findall(r"^- \[(.)\]", d1_del, re.M)
    assert items and all(i == "x" for i in items), "D1 is DONE but has unchecked items"
    assert "Render service names" in d1_state or "grocery-api" in d1_state, "deferred Render rename not recorded"


# ---------- points rule ----------

def test_points_rule_is_documented(project):
    rules = section(project, "2a.")
    assert "16 points" in rules
    assert re.search(r"never exceed", rules, re.I), "cap rule missing"
    assert re.search(r"do not carry over", rules, re.I), "no-carryover rule missing"
    assert re.search(r"derived", rules, re.I), "derived-balance design missing"


def test_points_default_matches_location_table(project):
    locations = section(project, "Locations")
    assert re.search(r"Weekly points.*16", locations), "Locations table must show the default of 16"


# ---------- per-person limit ----------

def test_limit_per_person_lives_on_location_items_not_items(project):
    items = section(project, "Items")
    assert "limit_per_person" not in items.lower().replace(" ", "_") or "moved" in items.lower()
    assert "Limit per person" not in items, "limit still listed on the shared Items table"
    loc_items = section(project, "Location items")
    assert re.search(r"Limit per person", loc_items)
    assert "toiletries = 2" in loc_items


def test_stock_fields_moved_off_shared_items(project):
    items = section(project, "Items")
    assert "Quantity in stock" not in items, "stock still described as an item-level field"
    assert "per-location" in items


def test_limit_is_enforced_in_user_and_cashier_flows(deliverables):
    assert "limit_per_person" in section(deliverables, "D5.")
    assert re.search(r"limit", section(deliverables, "D6."), re.I)


# ---------- Temple ID identity ----------

def test_temple_id_is_documented_everywhere(project, deliverables, state):
    for name, text in (("PROJECT", project), ("DELIVERABLES", deliverables), ("CURRENT_STATE", state)):
        assert "Temple ID" in text, f"Temple ID missing from {name}.md"


def test_identity_question_is_not_left_open_and_decided(project, state):
    assert "How is a person identified" not in project
    assert "How a person is identified" not in section(state, "Decisions Pending")


def test_qr_carries_temple_id_and_location(project, state):
    rules = section(project, "2a.")
    assert re.search(r"Temple ID and the \*\*location ID\*\*.*QR", rules, re.S)
    assert "QR carries Temple ID, location ID" in state


# ---------- location model ----------

def test_location_tables_are_documented(project):
    for heading in ("Locations", "Location hours", "Location closures", "Location items"):
        assert re.search(rf"^### {heading}", project, re.M), f"PROJECT.md lacks '### {heading}'"


@pytest.mark.parametrize("field", [
    "Location ID", "Name", "Campus", "Building / room", "Street address", "Latitude",
    "Directions note", "Accessibility note", "Phone", "Timezone", "Weekly points", "Week start day", "Active",
])
def test_locations_table_has_field(project, field):
    assert field in section(project, "Locations"), f"Locations table missing {field!r}"


def test_hours_and_closures_fields(project):
    hours = section(project, "Location hours")
    for f in ("Day of week", "Opens / closes"):
        assert f in hours
    closures = section(project, "Location closures")
    for f in ("Start / end", "Closed or special hours", "Reason"):
        assert f in closures
    assert "Open now" in project and "computed" in project


def test_location_id_is_unchangeable(project):
    assert re.search(r"Location ID \| Unchangeable", project)


def test_d2_covers_the_location_model(deliverables):
    d2 = section(deliverables, "D2.")
    for needle in ("Locations table", "Location hours", "closures", "Location items", "Orders and order_items",
                   "Atomic checkout", "RLS", "Temple ID"):
        assert needle.lower() in d2.lower(), f"D2 does not mention {needle!r}"


def test_location_features_appear_in_later_deliverables(deliverables):
    assert "location" in section(deliverables, "D3.").lower()   # staff limited to own location
    assert "location" in section(deliverables, "D5.").lower()   # location picker
    assert "location" in section(deliverables, "D6.").lower()   # QR for wrong location rejected
    assert "location" in section(deliverables, "D8.").lower()   # dashboard filter
    assert "location" in section(deliverables, "D9.").lower()   # closures and info page


def test_staff_are_scoped_to_one_location(project):
    assert re.search(r"belong to one location", project)


# ---------- architecture ----------

def test_read_only_user_model_is_documented(project):
    rules = section(project, "2a.")
    assert re.search(r"\*\*read-only\*\*", rules)
    assert re.search(r"saved \*\*locally", rules)
    assert re.search(r"already redeemed|redeemed", rules)
    assert "atomic" in rules


def test_no_server_side_shopping_list_planned(deliverables):
    d5 = section(deliverables, "D5.")
    assert "Save list locally" in d5
    d2 = section(deliverables, "D2.")
    # existing prototype table is marked as such, not planned as the end state
    assert "[~] Shopping lists (exists, server-side)" in d2


# ---------- stale text ----------

@pytest.mark.parametrize("stale", [
    "Max per person/visit",
    "How is a person identified so the weekly 16 points",
    "Whether guests can build and save a list without an account",
    "Points vs price model",
])
def test_stale_statements_are_gone(project, deliverables, state, stale):
    for name, text in (("PROJECT", project), ("DELIVERABLES", deliverables), ("CURRENT_STATE", state)):
        assert stale not in text, f"stale text in {name}.md: {stale!r}"


# ---------- open questions ----------

def test_open_questions_are_wellformed_and_current(project):
    qs = section(project, "5. Open Questions")
    lines = [l for l in qs.splitlines() if l.strip()]
    assert lines and all(l.startswith("- ") for l in lines)
    text = "\n".join(lines)
    for topic in ("shared across all pantries", "outside operating hours", "Temple ID", "super admin"):
        assert topic.lower() in text.lower(), f"open question about {topic!r} is missing"


def test_pending_decisions_are_not_also_listed_as_decided(state):
    decided = section(state, "Decisions Made").lower()
    pending = section(state, "Decisions Pending").lower()
    assert "temple id only" in decided
    assert "weekly points" in decided or "16" in decided
    assert "chat approach" in pending and "recipe" in pending   # untouched pending items survive
    assert "temple id only" not in pending
