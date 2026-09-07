#!/usr/bin/env node
/**
 * Builds dist/index.html and dist/schedule.csv from the deal terms below.
 * Every number on the page (headline, key terms, chart, schedule, fine print)
 * is derived from these constants, so a change here propagates everywhere.
 *
 *   node build.js
 */
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------- deal terms
const PRINCIPAL = 100000;          // $ funded at closing
const ANNUAL_RATE = 0.22;          // 22% per year, simple interest, paid monthly
const TERM_MONTHS = 24;            // balloon repayment of principal at maturity
const ISSUE_DATE_LABEL = 'September 2026';
// Office address: replace the bracketed placeholders before sending.
const ADDRESS_LINE_1 = '[Office street address · Suite]';
const ADDRESS_LINE_2 = 'Miami, FL [ZIP]';
// ---------------------------------------------------------------------------

const here = __dirname;
const dist = path.join(here, 'dist');
fs.mkdirSync(dist, { recursive: true });

const round2 = n => Math.round(n * 100) / 100;
const usd = (n, cents = false) => n.toLocaleString('en-US', {
  style: 'currency', currency: 'USD',
  minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0,
});
const pct = r => `${Math.round(r * 1000) / 10}%`.replace('.0%', '%');
const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty', 'Twenty-one', 'Twenty-two', 'Twenty-three', 'Twenty-four', 'Twenty-five', 'Twenty-six', 'Twenty-seven', 'Twenty-eight', 'Twenty-nine', 'Thirty', 'Thirty-one', 'Thirty-two', 'Thirty-three', 'Thirty-four', 'Thirty-five', 'Thirty-six'];

// ------------------------------------------------------------------ schedule
const monthly = round2(PRINCIPAL * ANNUAL_RATE / 12);
const totalInterest = round2(PRINCIPAL * ANNUAL_RATE * TERM_MONTHS / 12);
const lastPayment = round2(totalInterest - monthly * (TERM_MONTHS - 1)); // absorbs rounding
const yearInterest = round2(PRINCIPAL * ANNUAL_RATE);

const schedule = [];
for (let m = 0; m <= TERM_MONTHS; m++) {
  const isLast = m === TERM_MONTHS;
  const payment = m === 0 ? 0 : isLast ? lastPayment : monthly;
  const interestToDate = m === 0 ? 0 : isLast ? totalInterest : round2(monthly * m);
  schedule.push({
    month: m,
    payment,
    principalReturned: isLast ? PRINCIPAL : 0,
    interestToDate,
    principalOutstanding: isLast ? 0 : PRINCIPAL,
    value: round2(PRINCIPAL + interestToDate), // principal + interest paid to date
  });
}
const sumPayments = round2(schedule.reduce((a, r) => a + r.payment, 0));
if (sumPayments !== totalInterest) throw new Error(`payments ${sumPayments} != total interest ${totalInterest}`);

// --------------------------------------------------------------------- chart
const W = 684, H = 224, L = 52, R = 140, T = 22, B = 32;
const x0 = L, x1 = W - R, y0 = T, y1 = H - B, pw = x1 - x0, ph = y1 - y0;
const yMin = PRINCIPAL;
const yMax = Math.ceil((PRINCIPAL + totalInterest * 1.09) / 1000) * 1000;
const f = n => +n.toFixed(2);
const xs = m => x0 + (m / TERM_MONTHS) * pw;
const ys = v => y1 - ((v - yMin) / (yMax - yMin)) * ph;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

let d = `M${f(xs(0))},${f(ys(schedule[0].value))}`;
for (let m = 1; m <= TERM_MONTHS; m++) d += ` H${f(xs(m))} V${f(ys(schedule[m].value))}`;
const areaD = `${d} V${f(y1)} H${f(x0)} Z`;

const parts = [];
// gridlines + y labels
for (let v = yMin + 10000; v < yMax; v += 10000) {
  parts.push(`<line class="grid" x1="${x0}" x2="${x1}" y1="${f(ys(v))}" y2="${f(ys(v))}"/>`);
  parts.push(`<text x="${x0 - 8}" y="${f(ys(v))}" dy=".35em" text-anchor="end">$${v / 1000}k</text>`);
}
// year divider(s) + labels
for (let y = 1; y * 12 < TERM_MONTHS; y++) {
  parts.push(`<line class="divider" x1="${f(xs(y * 12))}" x2="${f(xs(y * 12))}" y1="${y0}" y2="${y1}"/>`);
}
for (let y = 0; y * 12 < TERM_MONTHS; y++) {
  const mid = Math.min(TERM_MONTHS, y * 12 + 6);
  parts.push(`<text class="year" x="${f(xs(mid))}" y="11" text-anchor="middle">Year ${y + 1}</text>`);
}
// area + series
parts.push(`<path class="area" d="${areaD}"/>`);
parts.push(`<path class="series" d="${d}"/>`);
// baseline (principal) + label
parts.push(`<line class="base" x1="${x0}" x2="${x1}" y1="${y1}" y2="${y1}"/>`);
parts.push(`<text x="${x0 - 8}" y="${y1}" dy=".35em" text-anchor="end">$${yMin / 1000}k</text>`);
parts.push(`<text class="sub" x="${x0 - 8}" y="${y1 + 12}" text-anchor="end">principal</text>`);
// x ticks
for (let m = 0; m <= TERM_MONTHS; m += 6) {
  parts.push(`<line class="tick" x1="${f(xs(m))}" x2="${f(xs(m))}" y1="${y1}" y2="${y1 + 4}"/>`);
  // month 0 is start-anchored so it never runs into the y-axis labels
  parts.push(`<text x="${f(xs(m)) - (m === 0 ? 1 : 0)}" y="${y1 + 20}" text-anchor="${m === 0 ? 'start' : 'middle'}">${m === 0 ? 'Funding' : 'Month ' + m}</text>`);
}
// milestone markers + direct labels
const mid12 = schedule[12];
if (TERM_MONTHS > 12) {
  const mx = f(xs(12)), my = f(ys(mid12.value));
  parts.push(`<text class="lbl-strong" x="${mx - 10}" y="${my - 24}" text-anchor="end">${usd(mid12.value)}</text>`);
  parts.push(`<text class="lbl" x="${mx - 10}" y="${my - 10}" text-anchor="end">+${pct(mid12.interestToDate / PRINCIPAL)} · end of year 1</text>`);
  parts.push(`<circle class="marker" cx="${mx}" cy="${my}" r="5"/>`);
}
const last = schedule[TERM_MONTHS];
const ex = f(xs(TERM_MONTHS)), ey = f(ys(last.value));
parts.push(`<circle class="marker" cx="${ex}" cy="${ey}" r="5"/>`);
parts.push(`<text class="lbl-hero" x="${ex + 14}" y="${ey + 2}">${usd(last.value)}</text>`);
parts.push(`<text class="lbl" x="${ex + 14}" y="${ey + 16}">${pct(last.interestToDate / PRINCIPAL)} total return</text>`);
parts.push(`<text class="lbl" x="${ex + 14}" y="${ey + 29}">Principal returned</text>`);
// hover layer
parts.push(`<line class="cross hide" x1="${x0}" x2="${x0}" y1="${y0}" y2="${y1}"/>`);
parts.push(`<circle class="hdot hide" cx="${x0}" cy="${y1}" r="5"/>`);

const chartSVG = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" tabindex="0" aria-labelledby="chartTitle chartDesc">
<title id="chartTitle">Value returned to the investor over ${TERM_MONTHS} months</title>
<desc id="chartDesc">Step chart rising from ${usd(PRINCIPAL)} at funding to ${usd(last.value)} at month ${TERM_MONTHS}, one step per monthly payment of ${usd(monthly, true)}. ${usd(mid12.value)} at month 12. Principal of ${usd(PRINCIPAL)} returned at month ${TERM_MONTHS}.</desc>
<defs>
<linearGradient id="goldStroke" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#C9963F"/><stop offset="1" stop-color="#F8D18C"/></linearGradient>
<linearGradient id="goldArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F8D18C" stop-opacity=".32"/><stop offset="1" stop-color="#F8D18C" stop-opacity=".02"/></linearGradient>
</defs>
${parts.join('\n')}
</svg>`;

// ------------------------------------------------------------------ assemble
const tableRows = schedule.slice(1).map(r => {
  const milestone = r.month % 12 === 0;
  return `<tr${milestone ? ' class="milestone"' : ''}><td>Month ${r.month}</td><td>${usd(r.payment + r.principalReturned, true)}</td><td>${usd(r.interestToDate, true)}</td><td>${usd(r.principalOutstanding)}</td><td>${usd(r.value, true)}</td></tr>`;
}).join('\n');

const fontsCSS = fs.readFileSync(path.join(here, 'assets', 'fonts-embedded.css'), 'utf8');
const logoSVG = fs.readFileSync(path.join(here, 'assets', 'sugar-in-the-raw-gold.svg'), 'utf8');

const vars = {
  FONTS_CSS: fontsCSS,
  LOGO_SVG: logoSVG,
  CHART_SVG: chartSVG,
  TABLE_ROWS: tableRows,
  SCHEDULE_JSON: JSON.stringify(schedule),
  GEOM_JSON: JSON.stringify({ W, H, x0, x1, y0, y1, pw, ph, yMin, yMax, term: TERM_MONTHS }),
  ISSUE_DATE: esc(ISSUE_DATE_LABEL),
  ADDRESS_LINE_1: esc(ADDRESS_LINE_1),
  ADDRESS_LINE_2: esc(ADDRESS_LINE_2),
  PRINCIPAL: usd(PRINCIPAL),
  TOTAL_BACK: usd(last.value),
  TOTAL_INTEREST: usd(totalInterest),
  MONTHLY: usd(monthly, true),
  YEAR_INTEREST: usd(yearInterest),
  RATE_PCT: pct(ANNUAL_RATE),
  TOTAL_PCT: pct(totalInterest / PRINCIPAL),
  TERM: String(TERM_MONTHS),
  TERM_WORDS: WORDS[TERM_MONTHS] || String(TERM_MONTHS),
};

let html = fs.readFileSync(path.join(here, 'template.html'), 'utf8');
html = html.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, k) => {
  if (!(k in vars)) throw new Error(`missing template variable ${k}`);
  return vars[k];
});
fs.writeFileSync(path.join(dist, 'index.html'), html);

const csv = ['month,payment,principal_returned,interest_to_date,principal_outstanding,value_returned_to_date']
  .concat(schedule.map(r => [r.month, r.payment.toFixed(2), r.principalReturned.toFixed(2), r.interestToDate.toFixed(2), r.principalOutstanding.toFixed(2), r.value.toFixed(2)].join(',')))
  .join('\n') + '\n';
fs.writeFileSync(path.join(dist, 'schedule.csv'), csv);

console.log(`principal ${usd(PRINCIPAL)} · ${pct(ANNUAL_RATE)}/yr · ${TERM_MONTHS} mo`);
console.log(`monthly ${usd(monthly, true)} (last ${usd(lastPayment, true)}) · interest ${usd(totalInterest)} (${pct(totalInterest / PRINCIPAL)}) · total back ${usd(last.value)}`);
console.log(`wrote dist/index.html (${(html.length / 1024).toFixed(0)} KB) and dist/schedule.csv`);
