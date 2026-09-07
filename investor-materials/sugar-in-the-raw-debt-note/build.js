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
  const principalReturned = isLast ? PRINCIPAL : 0;
  schedule.push({
    month: m,
    payment,
    principalReturned,
    interestToDate,
    principalOutstanding: isLast ? 0 : PRINCIPAL,
    paidToDate: round2(interestToDate + principalReturned), // cash received so far
  });
}
const sumPayments = round2(schedule.reduce((a, r) => a + r.payment, 0));
if (sumPayments !== totalInterest) throw new Error(`payments ${sumPayments} != total interest ${totalInterest}`);
const last = schedule[TERM_MONTHS];
const mid12 = schedule[Math.min(12, TERM_MONTHS)];
const totalBack = round2(PRINCIPAL + totalInterest);

// --------------------------------------------------------------------- chart
// Cumulative interest paid, from $0 at funding to the total at maturity.
const INK = '#111111', SEC = '#444444', MUTED = '#666666', GRID = '#E3E3E3', BASE = '#BBBBBB', SURFACE = '#FFFFFF';
const FONT = "'Source Sans 3','Helvetica Neue',Arial,sans-serif";
const W = 704, H = 280, L = 76, R = 168, T = 16, B = 34;
const x0 = L, x1 = W - R, y0 = T, y1 = H - B, pw = x1 - x0, ph = y1 - y0;
const yMin = 0;
const yMax = Math.ceil((totalInterest * 1.12) / 5000) * 5000;
const yStep = 10000;
const f = n => +n.toFixed(2);
const xs = m => f(x0 + (m / TERM_MONTHS) * pw);
const ys = v => f(y1 - ((v - yMin) / (yMax - yMin)) * ph);

function text(x, y, str, o = {}) {
  const attrs = [`x="${x}"`, `y="${y}"`];
  if (o.dy) attrs.push(`dy="${o.dy}"`);
  if (o.anchor) attrs.push(`text-anchor="${o.anchor}"`);
  const style = [`font-family:${FONT}`, `font-size:${o.size || 12}px`, `fill:${o.fill || MUTED}`];
  if (o.weight) style.push(`font-weight:${o.weight}`);
  if (o.tnum) style.push('font-variant-numeric:tabular-nums');
  return `<text ${attrs.join(' ')} style="${style.join(';')};">${esc(str)}</text>`;
}
const line = (xa, ya, xb, yb, stroke, extra = '') =>
  `<line x1="${xa}" y1="${ya}" x2="${xb}" y2="${yb}" stroke="${stroke}" stroke-width="1" shape-rendering="crispEdges"${extra}></line>`;

function chartSVG({ interactive }) {
  let d = `M${xs(0)},${ys(schedule[0].interestToDate)}`;
  for (let m = 1; m <= TERM_MONTHS; m++) d += ` H${xs(m)} V${ys(schedule[m].interestToDate)}`;
  const areaD = `${d} V${y1} H${x0} Z`;

  const p = [];
  for (let v = yMin + yStep; v < yMax; v += yStep) {
    p.push(line(x0, ys(v), x1, ys(v), GRID));
    p.push(text(x0 - 10, ys(v), usd(v), { anchor: 'end', dy: '.35em', tnum: true }));
  }
  for (let y = 1; y * 12 < TERM_MONTHS; y++) p.push(line(xs(y * 12), y0, xs(y * 12), y1, GRID));
  p.push(`<path d="${areaD}" fill="${INK}" fill-opacity="0.05"></path>`);
  p.push(`<path d="${d}" fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>`);
  p.push(line(x0, y1, x1, y1, BASE));
  p.push(text(x0 - 10, y1, usd(yMin), { anchor: 'end', dy: '.35em', tnum: true }));
  for (let m = 0; m <= TERM_MONTHS; m += 6) {
    p.push(line(xs(m), y1, xs(m), y1 + 4, BASE));
    // month 0 is start-anchored so it never runs into the y-axis labels
    p.push(text(xs(m) - (m === 0 ? 1 : 0), y1 + 20, m === 0 ? 'Start' : `Month ${m}`, { anchor: m === 0 ? 'start' : 'middle' }));
  }
  if (TERM_MONTHS > 12) {
    const mx = xs(12), my = ys(mid12.interestToDate);
    p.push(text(mx - 10, my - 12, `${usd(mid12.interestToDate)} at month 12`, { anchor: 'end', size: 13, weight: 600, fill: INK }));
    p.push(`<circle cx="${mx}" cy="${my}" r="5" fill="${INK}" stroke="${SURFACE}" stroke-width="2"></circle>`);
  }
  const ex = xs(TERM_MONTHS), ey = ys(last.interestToDate);
  p.push(`<circle cx="${ex}" cy="${ey}" r="5" fill="${INK}" stroke="${SURFACE}" stroke-width="2"></circle>`);
  p.push(text(ex + 14, ey + 4, `${usd(last.interestToDate)} total interest`, { size: 14, weight: 600, fill: INK }));
  p.push(text(ex + 14, ey + 21, `${pct(last.interestToDate / PRINCIPAL)} of principal`, { fill: SEC }));
  p.push(text(ex + 14, ey + 37, `${usd(PRINCIPAL)} principal returned`, { fill: SEC }));
  if (interactive) {
    p.push(line(x0, y0, x0, y1, MUTED, ` class="cross" style="visibility:hidden"`));
    p.push(`<circle class="hdot" cx="${x0}" cy="${y1}" r="5" fill="${INK}" stroke="${SURFACE}" stroke-width="2" style="visibility:hidden"></circle>`);
  }
  const title = `Cumulative interest paid to the investor over ${TERM_MONTHS} months`;
  const desc = `Step chart rising from $0 at funding to ${usd(last.interestToDate)} at month ${TERM_MONTHS}, one step per monthly payment of ${usd(monthly, true)}. ${usd(mid12.interestToDate)} at month 12. Principal of ${usd(PRINCIPAL)} returned at month ${TERM_MONTHS}.`;
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
const LOGO_STYLE = 'height:64px;width:auto;display:block;';

const common = {
  ISSUE_DATE: esc(ISSUE_DATE_LABEL),
  ADDRESS_LINE_1: esc(ADDRESS_LINE_1),
  ADDRESS_LINE_2: esc(ADDRESS_LINE_2),
  PRINCIPAL: usd(PRINCIPAL),
  TOTAL_BACK: usd(totalBack),
  TOTAL_INTEREST: usd(totalInterest),
  MONTHLY: usd(monthly, true),
  RATE_PCT: pct(ANNUAL_RATE),
  TOTAL_PCT: pct(totalInterest / PRINCIPAL),
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
  return `<tr${milestone ? ' class="milestone"' : ''}><td>Month ${r.month}</td><td>${usd(r.payment + r.principalReturned, true)}</td><td>${usd(r.interestToDate, true)}</td><td>${usd(r.principalOutstanding)}</td><td>${usd(r.paidToDate, true)}</td></tr>`;
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
const csv = ['month,payment,principal_returned,interest_to_date,principal_outstanding,total_paid_to_date']
  .concat(schedule.map(r => [r.month, r.payment.toFixed(2), r.principalReturned.toFixed(2), r.interestToDate.toFixed(2), r.principalOutstanding.toFixed(2), r.paidToDate.toFixed(2)].join(',')))
  .join('\n') + '\n';
fs.writeFileSync(path.join(dist, 'schedule.csv'), csv);

console.log(`principal ${usd(PRINCIPAL)} · ${pct(ANNUAL_RATE)}/yr · ${TERM_MONTHS} mo`);
console.log(`monthly ${usd(monthly, true)} (last ${usd(lastPayment, true)}) · interest ${usd(totalInterest)} (${pct(totalInterest / PRINCIPAL)}) · total back ${usd(totalBack)}`);
console.log(`wrote dist/index.html (${(page.length / 1024).toFixed(0)} KB), dist/schedule.csv, canvas/Main.dc.html (${(artboard.length / 1024).toFixed(0)} KB)`);
