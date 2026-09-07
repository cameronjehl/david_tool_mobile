#!/usr/bin/env node
/**
 * Renders dist/index.html to a US-Letter PDF and a 2x PNG of the sheet.
 * Requires Playwright with Chromium (npm i -D playwright && npx playwright install chromium).
 *
 *   node render.js
 */
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const dist = path.join(__dirname, 'dist');
  const url = 'file://' + path.join(dist, 'index.html');
  const browser = await chromium.launch();

  // PNG: the sheet at 2x
  const page = await browser.newPage({ viewport: { width: 1000, height: 1200 }, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const sheet = await page.$('.sheet');
  await sheet.screenshot({ path: path.join(dist, 'sugar-in-the-raw-debt-note.png') });

  // PDF: one Letter page, no margins
  await page.emulateMedia({ media: 'print' });
  await page.pdf({
    path: path.join(dist, 'sugar-in-the-raw-debt-note.pdf'),
    width: '8.5in', height: '11in', printBackground: true, pageRanges: '1',
    preferCSSPageSize: false,
  });

  await browser.close();
  console.log('wrote dist/sugar-in-the-raw-debt-note.png and .pdf');
})().catch(e => { console.error(e); process.exit(1); });
