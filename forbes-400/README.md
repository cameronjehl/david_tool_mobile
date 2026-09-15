# Forbes 400 by field

An interactive breakdown of the Forbes 400 (the 400 richest Americans) by the
field each fortune came from, with the share of members and the share of
combined net worth per field.

- `index.html` – the chart page. Self-contained: the roster is inlined, no
  build step or server needed. Open it in a browser.
- `data/forbes400_<year>.csv` / `.json` – the full roster with rank, name,
  net worth ($M), Forbes category, assigned field, source of wealth, age,
  gender, state and self-made flag.
- `data/summary_<year>.json` – member counts, percent of list, combined net
  worth and percent of wealth per Forbes category and per field.
- `scripts/build.py` – fetches the list from Forbes' list API, assigns fields,
  writes the data files and injects the roster into `index.html`.

## Two ways to group

1. **Forbes' 17 categories**, exactly as Forbes publishes them (Technology,
   Finance & Investments, Food & Beverage, ...).
2. **Finance split into sub-fields.** Forbes puts every financier in a single
   "Finance & Investments" category (108 of 400 members in 2026). The page's
   default view splits that category by the primary vehicle behind the
   fortune:

   | Sub-field | What it covers |
   |---|---|
   | Private equity & buyouts | Buyout, growth-equity, private-credit and merchant-banking fortunes (KKR, Blackstone, Apollo, Carlyle, TPG, Thoma Bravo, Vista, Clearlake, H.I.G., HPS, BDT & MSD ...). This is where the deal-making / M&A money sits. |
   | Hedge funds | Citadel, Renaissance, Bridgewater, Millennium, Point72, Two Sigma, Elliott, Tiger Global ... |
   | Trading & brokerage | Market makers, exchanges and brokerages (Interactive Brokers, Susquehanna, Schwab, Virtu, Robinhood, Cantor Fitzgerald ...) |
   | Asset & wealth management | Fidelity, Franklin Templeton, Fisher, Baron, AQR, Guggenheim, Creative Planning |
   | Venture capital | Founders Fund, Kleiner Perkins, Sequoia, Thrive, Dragoneer, Gigafund ... |
   | Banking, lending & insurance | Rocket Mortgage, Beal Bank, Hankey Group, UWM, Ryan Specialty, Erie Indemnity |
   | Financial data & research | Bloomberg LP, Morningstar |
   | Crypto | Coinbase, Ripple, Galaxy Digital |
   | Holding companies & investors | Berkshire Hathaway, Anschutz, the Pritzker and Ziff families, Royalty Pharma and other diversified investors |

   The assignment is a hand-curated map keyed by Forbes' stable person slug in
   `scripts/build.py` (`SUBFIELD_BY_SLUG`). Members that join the category in a
   later edition and are not in the map fall back to keyword rules on Forbes'
   "source" string, and the build prints a warning so the map can be updated.

## Rebuilding for a new edition

```bash
python3 forbes-400/scripts/build.py --year 2027
```

The script fetches `https://www.forbes.com/forbesapi/person/forbes-400/<year>/position/true.json`,
rewrites the data files and the inline roster in `index.html`, prints the
summary tables, and warns about any financier it could not classify from the
curated map.

To rebuild from a saved API response instead of fetching:

```bash
python3 forbes-400/scripts/build.py --cache path/to/response.json
```

## Design notes

- Single-hue bars for the share chart (one series, so no legend); the
  headcount-versus-wealth chart uses two validated categorical hues plus a
  shape difference (disc vs. diamond) so the series never rely on color alone.
- Every chart has a table twin (the Chart / Table toggle), tooltips on hover
  and keyboard focus, and light and dark themes.
- No external libraries; the only network requests are the two Google Fonts
  faces, with system fallbacks.
