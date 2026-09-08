#!/usr/bin/env node
/**
 * Renders each dist/<slug>/index.html to a US-Letter PDF and a 2x PNG of the sheet.
 * Requires Playwright with Chromium (npm i -D playwright && npx playwright install chromium).
 *
 *   node render.js
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const distRoot = path.join(__dirname, 'dist');
  const slugs = JSON.parse(fs.readFileSync(path.join(distRoot, 'variants.json'), 'utf8'));
  const browser = await chromium.launch();

  for (const slug of slugs) {
    const dist = path.join(distRoot, slug);
    const base = `sugar-in-the-raw-debt-note-${slug}`;
    const page = await browser.newPage({ viewport: { width: 1000, height: 1200 }, deviceScaleFactor: 2 });
    await page.goto('file://' + path.join(dist, 'index.html'), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);

    // PNG: the sheet at 2x
    const sheet = await page.$('.sheet');
    await sheet.screenshot({ path: path.join(dist, `${base}.png`) });

    // PDF: one Letter page, no margins
    await page.emulateMedia({ media: 'print' });
    await page.pdf({
      path: path.join(dist, `${base}.pdf`),
      width: '8.5in', height: '11in', printBackground: true, pageRanges: '1',
      preferCSSPageSize: false,
    });
    await page.close();
    console.log(`wrote dist/${slug}/${base}.png and .pdf`);
  }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
