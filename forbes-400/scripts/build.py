#!/usr/bin/env python3
"""Build the Forbes 400 field breakdown.

Fetches the current Forbes 400 list from Forbes' list API, classifies every
member into a field, writes the data files under ../data, and injects the
compact roster into ../index.html between the ROSTER markers.

Usage:
    python3 scripts/build.py                     # fetch the 2026 list live
    python3 scripts/build.py --year 2027         # a later edition
    python3 scripts/build.py --cache resp.json   # reuse a saved API response

Forbes files every financier under one category, "Finance & Investments".
This script splits that category into sub-fields by the primary vehicle each
member's fortune came from. The split is a hand-curated map keyed by Forbes'
stable person slug (see SUBFIELD_BY_SLUG); members not in the map fall back
to keyword rules on Forbes' "source" string so a new edition still builds.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
PAGE = ROOT / "index.html"

API = (
    "https://www.forbes.com/forbesapi/person/forbes-400/{year}/position/true.json"
    "?fields=rank,uri,personName,finalWorth,category,industries,source,age,gender,"
    "state,city,countryOfCitizenship,selfMade,selfMadeRank&limit=400"
)
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

FINANCE = "Finance & Investments"

# Sub-field names, in the order they should appear when tied.
PRIVATE_EQUITY = "Private equity & buyouts"
HEDGE_FUNDS = "Hedge funds"
TRADING = "Trading & brokerage"
ASSET_MGMT = "Asset & wealth management"
VENTURE = "Venture capital"
BANKING = "Banking, lending & insurance"
FIN_DATA = "Financial data & research"
CRYPTO = "Crypto"
HOLDINGS = "Holding companies & investors"
UNCLASSIFIED = "Other finance & investing"

SUBFIELD_BY_SLUG: dict[str, str] = {}


def _assign(field: str, slugs: str) -> None:
    for slug in slugs.split():
        if slug in SUBFIELD_BY_SLUG:
            raise SystemExit(f"slug mapped twice: {slug}")
        SUBFIELD_BY_SLUG[slug] = field


# Buyout, growth-equity, private-credit and merchant-banking fortunes. This is
# where the deal-making / M&A money on the list sits (KKR, Blackstone, Apollo,
# Carlyle, TPG, Thoma Bravo, Vista, Clearlake, H.I.G., HPS, BDT & MSD, ...).
_assign(PRIVATE_EQUITY, """
    stephen-schwarzman antonio-gracias leon-black george-roberts henry-kravis
    josh-harris antony-ressler michael-dorrell orlando-bravo ramzi-musallam
    robert-f-smith tom-gores jonathan-gray sami-mnaymneh tony-tamer marc-rowan
    michael-kim justin-ishbia stephen-feinberg steven-klinsky larry-gies
    daniel-daniello scott-kapnick byron-trott jim-coulter hamilton-james
    behdad-eghbali jose-e-feliciano david-rubenstein carl-thoma
""")

_assign(HEDGE_FUNDS, """
    ken-griffin marilyn-simons david-tepper israel-englander steve-cohen
    ray-dalio john-paulson william-ackman david-shaw bruce-kovner
    philippe-laffont john-overdeck david-siegel-1 stanley-druckenmiller
    george-soros chase-coleman-iii paul-tudor-jones-ii paul-singer
    stephen-mandel-jr daniel-och daniel-sundheim daniel-loeb
""")

_assign(VENTURE, """
    peter-thiel john-doerr josh-kushner douglas-leone mark-stevens tench-coxe
    michael-moritz luke-nosek marc-stad
""")

_assign(ASSET_MGMT, """
    abigail-johnson peter-mallouk edward-johnson-iv ken-fisher elizabeth-johnson
    ron-baron clifford-asness mark-walter charles-b-johnson rupert-johnson-jr
""")

_assign(TRADING, """
    thomas-peterffy jeff-yass arthur-dantchik charles-schwab j-joe-ricketts
    vincent-viola baiju-bhatt howard-lutnick vlad-tenev peter-kellogg
    rodger-riney
""")

_assign(BANKING, """
    daniel-gilbert andrew-beal don-hankey patrick-ryan mat-ishbia thomas-hagen
    jennifer-gilbert
""")

_assign(CRYPTO, "brian-armstrong chris-larsen michael-novogratz")

_assign(FIN_DATA, "michael-bloomberg joe-mansueto thomas-secunda")

# Conglomerate and family-office fortunes with no single dominant vehicle.
_assign(HOLDINGS, """
    warren-buffett philip-anschutz ken-langone todd-boehly michael-milken
    daniel-ziff dirk-ziff robert-ziff karen-pritzker thomas-pritzker
    penny-pritzker pablo-legorreta herbert-wertheim
""")

# Fallback for members that join the Finance & Investments category in a later
# edition and are not yet in the curated map. First match wins.
SOURCE_RULES: list[tuple[str, str]] = [
    (r"private equity|leveraged buyout|buyout|growth equity|private credit", PRIVATE_EQUITY),
    (r"hedge fund", HEDGE_FUNDS),
    (r"venture", VENTURE),
    (r"crypto|bitcoin|blockchain", CRYPTO),
    (r"broker|trading|exchange", TRADING),
    (r"bank|mortgage|loan|lend|insurance", BANKING),
    (r"money management|asset management|wealth|mutual fund|fidelity|franklin", ASSET_MGMT),
    (r"bloomberg|research|data", FIN_DATA),
]


def classify(person: dict, warnings: list[str]) -> str:
    """Return the field for one list member."""
    category = person["category"]
    if category != FINANCE:
        return category
    slug = person["uri"]
    if slug in SUBFIELD_BY_SLUG:
        return SUBFIELD_BY_SLUG[slug]
    source = (person.get("source") or "").lower()
    for pattern, field in SOURCE_RULES:
        if re.search(pattern, source):
            warnings.append(f"{person['personName']} ({slug}) not in curated map; "
                            f"source '{person.get('source')}' -> {field}")
            return field
    warnings.append(f"{person['personName']} ({slug}) not in curated map and no "
                    f"source rule matched ('{person.get('source')}') -> {UNCLASSIFIED}")
    return UNCLASSIFIED


def fetch(year: int) -> dict:
    req = urllib.request.Request(API.format(year=year), headers={
        "User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)


def load_members(args: argparse.Namespace) -> list[dict]:
    if args.cache:
        payload = json.loads(Path(args.cache).read_text())
    else:
        payload = fetch(args.year)
    members = payload["personList"]["personsLists"]
    if not members:
        raise SystemExit("Forbes returned an empty list; check the year or the API path.")
    return sorted(members, key=lambda p: (p["rank"], -p["finalWorth"], p["personName"]))


def build(args: argparse.Namespace) -> None:
    members = load_members(args)
    year = members[0].get("year", args.year)
    warnings: list[str] = []

    records = []
    for p in members:
        records.append({
            "rank": p["rank"],
            "name": p["personName"],
            "net_worth_musd": p["finalWorth"],
            "forbes_category": p["category"],
            "field": classify(p, warnings),
            "source": p.get("source", ""),
            "age": p.get("age"),
            "gender": p.get("gender"),
            "state": p.get("state"),
            "self_made": p.get("selfMade"),
            "slug": p["uri"],
        })

    # Curated slugs that no longer appear on the list are worth knowing about.
    present = {r["slug"] for r in records}
    stale = sorted(s for s in SUBFIELD_BY_SLUG if s not in present)
    if stale:
        warnings.append(f"{len(stale)} curated slugs are not on this year's list: "
                        + ", ".join(stale))

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    csv_path = DATA_DIR / f"forbes400_{year}.csv"
    with csv_path.open("w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(records[0].keys()))
        writer.writeheader()
        writer.writerows(records)

    json_path = DATA_DIR / f"forbes400_{year}.json"
    json_path.write_text(json.dumps(records, indent=1) + "\n")

    summary = summarize(records, year)
    summary_path = DATA_DIR / f"summary_{year}.json"
    summary_path.write_text(json.dumps(summary, indent=1) + "\n")

    inject_roster(records, year)

    print_summary(summary)
    for w in warnings:
        print("WARNING:", w, file=sys.stderr)
    print(f"\nwrote {csv_path.name}, {json_path.name}, {summary_path.name}; "
          f"roster injected into {PAGE.name}")


def summarize(records: list[dict], year: int) -> dict:
    n = len(records)
    total = sum(r["net_worth_musd"] for r in records)

    def group(key: str) -> list[dict]:
        buckets: dict[str, dict] = defaultdict(lambda: {"members": 0, "net_worth_musd": 0.0})
        for r in records:
            b = buckets[r[key]]
            b["members"] += 1
            b["net_worth_musd"] += r["net_worth_musd"]
        rows = []
        for name, b in buckets.items():
            rows.append({
                "field": name,
                "members": b["members"],
                "pct_of_list": round(100 * b["members"] / n, 2),
                "net_worth_musd": round(b["net_worth_musd"], 1),
                "pct_of_wealth": round(100 * b["net_worth_musd"] / total, 2),
            })
        rows.sort(key=lambda r: (-r["members"], -r["net_worth_musd"], r["field"]))
        return rows

    return {
        "list": "Forbes 400",
        "year": year,
        "members": n,
        "total_net_worth_musd": round(total, 1),
        "min_net_worth_musd": min(r["net_worth_musd"] for r in records),
        "by_forbes_category": group("forbes_category"),
        "by_field": group("field"),
    }


def print_summary(summary: dict) -> None:
    for title, key in (("Forbes categories", "by_forbes_category"), ("Fields", "by_field")):
        print(f"\n{title} ({summary['year']}, n={summary['members']})")
        print(f"  {'field':34s} {'members':>7s} {'% list':>7s} {'$B':>9s} {'% wealth':>9s}")
        for row in summary[key]:
            print(f"  {row['field']:34s} {row['members']:7d} {row['pct_of_list']:7.1f} "
                  f"{row['net_worth_musd']/1000:9.1f} {row['pct_of_wealth']:9.1f}")


def inject_roster(records: list[dict], year: int) -> None:
    """Replace the inline roster in index.html with a compact array."""
    compact = [[r["rank"], r["name"], r["net_worth_musd"], r["forbes_category"],
                r["field"], r["source"]] for r in records]
    payload = json.dumps(compact, ensure_ascii=False, separators=(",", ":"))
    html = PAGE.read_text()
    start, end = "/*ROSTER:START*/", "/*ROSTER:END*/"
    i, j = html.find(start), html.find(end)
    if i < 0 or j < 0:
        raise SystemExit(f"ROSTER markers not found in {PAGE}")
    html = html[: i + len(start)] + payload + html[j:]
    html = re.sub(r'data-list-year="\d{4}"', f'data-list-year="{year}"', html, count=1)
    PAGE.write_text(html)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--year", type=int, default=2026, help="list edition to fetch")
    parser.add_argument("--cache", help="path to a saved API response to use instead of fetching")
    build(parser.parse_args())


if __name__ == "__main__":
    main()
