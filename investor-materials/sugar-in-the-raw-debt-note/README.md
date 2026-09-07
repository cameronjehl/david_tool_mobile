# Sugar in the Raw · Private Debt Note (investor one-pager)

A branded, single-page summary of the $100,000 debt piece for Sugar in the Raw:
22% annual return paid monthly, principal returned as a balloon at month 24,
$44,000 total interest (44% on capital), $144,000 total back to the investor.

## Deliverables (in `dist/`)

| File | Use |
|---|---|
| `sugar-in-the-raw-debt-note.pdf` | US Letter, one page. Attach to the note packet or email. |
| `sugar-in-the-raw-debt-note.png` | 2x PNG of the sheet (1632 × 2112). Text/DM friendly. |
| `index.html` | Self-contained web version (fonts and logo embedded) with hover readout and the full schedule table. |
| `schedule.csv` | The 24-month payment schedule as data. |

## Before sending

1. **Office address.** `build.js` ships with a bracketed placeholder
   (`[Office street address · Suite]` / `Miami, FL [ZIP]`). Set `ADDRESS_LINE_1`
   and `ADDRESS_LINE_2`, then rebuild.
2. **Terms.** If the deal changes, edit `PRINCIPAL`, `ANNUAL_RATE`, `TERM_MONTHS`
   or `ISSUE_DATE_LABEL` in `build.js`. Every figure on the page is derived from
   those constants (headline, key terms, chart, schedule, fine print).
3. **Legal review.** The fine print states this is a discussion summary, not an
   offer of securities, and that interest is generally taxable while return of
   principal is not. Have counsel confirm the language matches the executed note.

## Rebuild

```bash
node build.js        # -> dist/index.html, dist/schedule.csv
node render.js       # -> dist/*.pdf, dist/*.png  (needs Playwright + Chromium)
```

## Assumptions baked into the numbers

- Simple interest at 22% per annum on $100,000, paid monthly: $1,833.33 × 24.
- Final payment is $1,833.41 so the 24 payments sum to exactly $44,000.
- The chart's y-axis starts at the $100,000 principal; the shaded area is the
  interest earned above principal, so the truncated axis is the story, not a trick.

## Assets

- `assets/sugar-in-the-raw-gold.svg` — gold variant extracted from
  `Final Sugar Logo (Original Concept).svg` in Drive → Sugar In The Raw LOGOS FINAL.
- `assets/fonts-embedded.css` — Bodoni Moda + Libre Franklin (Google Fonts, OFL),
  latin subsets embedded as data URIs so the page renders identically offline.
