# Sugar in the Raw · Private Debt Note (investor one-pager)

A plain, single-page summary of the $100,000 debt piece for Sugar in the Raw:
22% annual return paid monthly, principal returned as a balloon at month 24,
$44,000 total interest (44% on capital), $144,000 total back to the investor.
White page, black logo, a terms table, a cumulative-interest chart, address
and contact. One typeface (Source Sans 3), no sales copy.

Two variants are built from one source: a 24-month note ($44,000 interest,
$144,000 total) and a 12-month note ($22,000 interest, $122,000 total).

## Deliverables (in `dist/<term>/`)

| File | Use |
|---|---|
| `sugar-in-the-raw-debt-note-<term>.pdf` | US Letter, one page. Attach to the note packet or email. |
| `sugar-in-the-raw-debt-note-<term>.png` | 2x PNG of the sheet (1632 × 2112). Text/DM friendly. |
| `index.html` | Self-contained web version (fonts and logo embedded) with a hover readout and the full schedule table. |
| `schedule.csv` | The payment schedule as data. |

`canvas/<term>/` holds the same sheet as a Letter-size design artboard
(`Main.dc.html`, `canvas.json`, the logo), the source of the editable design
canvas where the layout can be tweaked by hand and exported as PNG/PDF.

## Changing the terms

Edit the constants at the top of `build.js` (`PRINCIPAL`, `ANNUAL_RATE`,
`ISSUE_DATE_LABEL`, `ADDRESS_LINE_1/2`, and the `VARIANTS` list of terms), then
rebuild. Every figure on a page is derived from them: title, terms table,
chart, schedule, fine print.

```bash
node build.js        # -> dist/<term>/index.html + schedule.csv, canvas/<term>/Main.dc.html
node render.js       # -> dist/<term>/*.pdf, *.png  (needs Playwright + Chromium)
```

Copy lives in `templates/sheet.html` (shared by the web page and the artboard).

## Before sending

The fine print states this is a discussion summary, not an offer of
securities, and that interest is generally taxable while return of principal
is not. Have counsel confirm the language matches the executed note.

## Assumptions baked into the numbers

- Simple interest at 22% per annum on $100,000, paid monthly: $1,833.33 per month.
- The final payment absorbs rounding so the payments sum exactly to the total
  interest ($1,833.41 on the 24-month note, $1,833.37 on the 12-month note).
- The chart plots cumulative interest paid from $0 at funding to the total at
  maturity, one step per monthly payment; the balloon is stated in the labels
  and the terms table rather than drawn (it would dwarf the interest steps).

## Assets

- `assets/sugar-in-the-raw-black.svg` — black variant extracted from
  `Final Sugar Logo (Original Concept).svg` in Drive → Sugar In The Raw LOGOS FINAL.
- `assets/fonts-embedded.css` — Source Sans 3 (Google Fonts, OFL), latin subset
  embedded as a data URI so the page renders identically offline.
