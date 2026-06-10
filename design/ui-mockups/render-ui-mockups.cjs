
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
(async () => {
  const outDir = path.resolve('design/ui-mockups');
  const htmlPath = path.join(outDir, 'shenle-admin-ui-mockups.html');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1480, height: 1810 }, deviceScaleFactor: 1 });
  await page.goto('file://' + htmlPath.replace(/\\/g, '/'));
  await page.screenshot({ path: path.join(outDir, 'shenle-ui-board.png'), fullPage: true });
  const shots = [
    ['dashboard', '01-admin-dashboard.png'],
    ['property-list', '02-property-list-filter.png'],
    ['property-form', '03-property-form.png'],
    ['sales-control', '04-sales-control.png'],
  ];
  for (const [name, file] of shots) {
    const el = await page.locator(`[data-shot="${name}"]`).elementHandle();
    await el.screenshot({ path: path.join(outDir, file) });
  }
  await browser.close();
  console.log('Generated UI mockups in ' + outDir);
})();
