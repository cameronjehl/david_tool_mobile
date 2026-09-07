#!/usr/bin/env node
/**
 * Builds the investor one-pager from the deal terms below:
 *   dist/index.html      standalone web page (hover readout + schedule table)
 *   dist/schedule.csv    the payment schedule as data
 *   canvas/Main.dc.html  the same sheet as a Letter-size design artboard
 * Every number on the page is derived from these constants.
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
const ADDRESS_LINE_1 = '164 NW 20th St, Ste 205';
const ADDRESS_LINE_2 = 'Miami, FL 33127';
// ---------------------------------------------------------------------------

const here = __dirname;
const dist = path.join(here, 'dist');
const canvasDir = path.join(here, 'canvas');
fs.mkdirSync(dist, { recursive: true });
fs.mkdirSync(canvasDir, { recursive: true });

const round2 = n => Math.round(n * 100) / 100;
const usd = (n, cents = false) => n.toLocaleString('en-US', {
  style: 'currency', currency: 'USD',
  minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0,
});
const pct = r => `${Math.round(r * 1000) / 10}%`.replace('.0%', '%');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fill = (tpl, vars) => tpl.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, k) => {
  if (!(k in vars)) throw new Error(`missing template variable ${k}`);
  return vars[k];
});

// ------------------------------------------------------------------ schedule
const monthly = round2(PRINCIPAL * ANNUAL_RATE / 12);
const totalInterest = round2(PRINCIPAL * ANNUAL_RATE * TERM_MONTHS / 12);
const lastPayment = round2(totalInterest - monthly * (TERM_MONTHS - 1)); // absorbs rounding

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
const last = schedule[TERM_MONTHS];
const mid12 = schedule[Math.min(12, TERM_MONTHS)];

// --------------------------------------------------------------------- chart
const INK = '#141210', SEC = '#5C554B', MUTED = '#8A8172', GRID = '#E6E1D8', BASE = '#C9C2B6', SURFACE = '#FFFFFF';
const FONT = "'Libre Franklin','Helvetica Neue',Arial,sans-serif";
const W = 704, H = 330, L = 52, R = 136, T = 20, B = 34;
const x0 = L, x1 = W - R, y0 = T, y1 = H - B, pw = x1 - x0, ph = y1 - y0;
const yMin = PRINCIPAL;
const yMax = Math.ceil((PRINCIPAL + totalInterest * 1.09) / 1000) * 1000;
const f = n => +n.toFixed(2);
const xs = m => f(x0 + (m / TERM_MONTHS) * pw);
const ys = v => f(y1 - ((v - yMin) / (yMax - yMin)) * ph);

function text(x, y, str, o = {}) {
  const attrs = [`x="${x}"`, `y="${y}"`];
  if (o.dy) attrs.push(`dy="${o.dy}"`);
  if (o.anchor) attrs.push(`text-anchor="${o.anchor}"`);
  const style = [`font-family:${FONT}`, `font-size:${o.size || 11}px`, `fill:${o.fill || MUTED}`];
  if (o.weight) style.push(`font-weight:${o.weight}`);
  if (o.tnum) style.push('font-variant-numeric:tabular-nums');
  return `<text ${attrs.join(' ')} style="${style.join(';')};">${esc(str)}</text>`;
}
const line = (xa, ya, xb, yb, stroke, extra = '') =>
  `<line x1="${xa}" y1="${ya}" x2="${xb}" y2="${yb}" stroke="${stroke}" stroke-width="1" shape-rendering="crispEdges"${extra}></line>`;

function chartSVG({ interactive }) {
  let d = `M${xs(0)},${ys(schedule[0].value)}`;
  for (let m = 1; m <= TERM_MONTHS; m++) d += ` H${xs(m)} V${ys(schedule[m].value)}`;
  const areaD = `${d} V${y1} H${x0} Z`;

  const p = [];
  for (let v = yMin + 10000; v < yMax; v += 10000) {
    p.push(line(x0, ys(v), x1, ys(v), GRID));
    p.push(text(x0 - 8, ys(v), `$${v / 1000}k`, { anchor: 'end', dy: '.35em', tnum: true }));
  }
  for (let y = 1; y * 12 < TERM_MONTHS; y++) p.push(line(xs(y * 12), y0, xs(y * 12), y1, GRID));
  p.push(`<path d="${areaD}" fill="${INK}" fill-opacity="0.05"></path>`);
  p.push(`<path d="${d}" fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>`);
  p.push(line(x0, y1, x1, y1, BASE));
  p.push(text(x0 - 8, y1, `$${yMin / 1000}k`, { anchor: 'end', dy: '.35em', tnum: true }));
  p.push(text(x0 - 8, y1 + 12, 'principal', { anchor: 'end', size: 10 }));
  for (let m = 0; m <= TERM_MONTHS; m += 6) {
    p.push(line(xs(m), y1, xs(m), y1 + 4, BASE));
    // month 0 is start-anchored so it never runs into the y-axis labels
    p.push(text(xs(m) - (m === 0 ? 1 : 0), y1 + 20, m === 0 ? 'Funding' : `Month ${m}`, { anchor: m === 0 ? 'start' : 'middle' }));
  }
  if (TERM_MONTHS > 12) {
    const mx = xs(12), my = ys(mid12.value);
    p.push(text(mx - 10, my - 24, usd(mid12.value), { anchor: 'end', size: 14, weight: 600, fill: INK }));
    p.push(text(mx - 10, my - 10, `+${pct(mid12.interestToDate / PRINCIPAL)} · end of year 1`, { anchor: 'end', fill: SEC }));
    p.push(`<circle cx="${mx}" cy="${my}" r="5" fill="${INK}" stroke="${SURFACE}" stroke-width="2"></circle>`);
  }
  const ex = xs(TERM_MONTHS), ey = ys(last.value);
  p.push(`<circle cx="${ex}" cy="${ey}" r="5" fill="${INK}" stroke="${SURFACE}" stroke-width="2"></circle>`);
  p.push(text(ex + 14, ey + 2, usd(last.value), { size: 16, weight: 600, fill: INK }));
  p.push(text(ex + 14, ey + 17, `${pct(last.interestToDate / PRINCIPAL)} total return`, { fill: SEC }));
  p.push(text(ex + 14, ey + 31, 'Principal returned', { fill: SEC }));
  if (interactive) {
    p.push(line(x0, y0, x0, y1, MUTED, ` class="cross" style="visibility:hidden"`));
    p.push(`<circle class="hdot" cx="${x0}" cy="${y1}" r="5" fill="${INK}" stroke="${SURFACE}" stroke-width="2" style="visibility:hidden"></circle>`);
  }
  const title = `Value returned to the investor over ${TERM_MONTHS} months`;
  const desc = `Step chart rising from ${usd(PRINCIPAL)} at funding to ${usd(last.value)} at month ${TERM_MONTHS}, one step per monthly payment of ${usd(monthly, true)}. ${usd(mid12.value)} at month 12. Principal of ${usd(PRINCIPAL)} returned at month ${TERM_MONTHS}.`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(title)}"${interactive ? ' tabindex="0"' : ''} style="display:block;width:100%;height:auto;overflow:visible;">
<title>${esc(title)}</title>
<desc>${esc(desc)}</desc>
${p.join('\n')}
</svg>`;
}

// ------------------------------------------------------------------ assemble
const read = p => fs.readFileSync(path.join(here, p), 'utf8');
const fontsCSS = read('assets/fonts-embedded.css');
const logoSVG = read('assets/sugar-in-the-raw-black.svg').trim();
const LOGO_STYLE = 'height:72px;width:auto;display:block;';

const common = {
  ISSUE_DATE: esc(ISSUE_DATE_LABEL),
  ADDRESS_LINE_1: esc(ADDRESS_LINE_1),
  ADDRESS_LINE_2: esc(ADDRESS_LINE_2),
  PRINCIPAL: usd(PRINCIPAL),
  TOTAL_BACK: usd(last.value),
  TOTAL_INTEREST: usd(totalInterest),
  MONTHLY: usd(monthly, true),
  RATE_PCT: pct(ANNUAL_RATE),
  TERM: String(TERM_MONTHS),
};
const sheetTpl = read('templates/sheet.html');

// standalone page
const pageSheet = fill(sheetTpl, {
  ...common,
  LOGO: logoSVG.replace('<svg ', `<svg style="${LOGO_STYLE}" `),
  CHART_SVG: chartSVG({ interactive: true }),
  TIP: '<div class="tip" hidden></div>',
});
const tableRows = schedule.slice(1).map(r => {
  const milestone = r.month % 12 === 0;
  return `<tr${milestone ? ' class="milestone"' : ''}><td>Month ${r.month}</td><td>${usd(r.payment + r.principalReturned, true)}</td><td>${usd(r.interestToDate, true)}</td><td>${usd(r.principalOutstanding)}</td><td>${usd(r.value, true)}</td></tr>`;
}).join('\n');
const page = fill(read('templates/page.html'), {
  ...common,
  FONTS_CSS: fontsCSS,
  SHEET: pageSheet,
  TABLE_ROWS: tableRows,
  SCHEDULE_JSON: JSON.stringify(schedule),
  GEOM_JSON: JSON.stringify({ W, H, x0, x1, y0, y1, pw, ph, yMin, yMax, term: TERM_MONTHS }),
});
fs.writeFileSync(path.join(dist, 'index.html'), page);

// design artboard (same sheet, static)
const artboardSheet = fill(sheetTpl, {
  ...common,
  LOGO: `<img src="sugar-in-the-raw-black.svg" alt="Sugar in the Raw" style="${LOGO_STYLE}">`,
  CHART_SVG: chartSVG({ interactive: false }),
  TIP: '',
});
const artboard = fill(read('templates/artboard.dc.html'), { FONTS_CSS: fontsCSS, SHEET: artboardSheet });
fs.writeFileSync(path.join(canvasDir, 'Main.dc.html'), artboard);
fs.copyFileSync(path.join(here, 'assets', 'sugar-in-the-raw-black.svg'), path.join(canvasDir, 'sugar-in-the-raw-black.svg'));

// schedule data
const csv = ['month,payment,principal_returned,interest_to_date,principal_outstanding,value_returned_to_date']
  .concat(schedule.map(r => [r.month, r.payment.toFixed(2), r.principalReturned.toFixed(2), r.interestToDate.toFixed(2), r.principalOutstanding.toFixed(2), r.value.toFixed(2)].join(',')))
  .join('\n') + '\n';
fs.writeFileSync(path.join(dist, 'schedule.csv'), csv);

console.log(`principal ${usd(PRINCIPAL)} · ${pct(ANNUAL_RATE)}/yr · ${TERM_MONTHS} mo`);
console.log(`monthly ${usd(monthly, true)} (last ${usd(lastPayment, true)}) · interest ${usd(totalInterest)} (${pct(totalInterest / PRINCIPAL)}) · total back ${usd(last.value)}`);
console.log(`wrote dist/index.html (${(page.length / 1024).toFixed(0)} KB), dist/schedule.csv, canvas/Main.dc.html (${(artboard.length / 1024).toFixed(0)} KB)`);
