import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true, defaultViewport: { width: 700, height: 900, deviceScaleFactor: 1 } });
const page = await browser.newPage();
for (const g of ['A', 'B', 'Dual', 'C', 'D']) {
  await page.goto('file:///user-code/sas-relay/out/email-' + g + '.html', { waitUntil: 'networkidle0', timeout: 60000 });
  await page.screenshot({ path: 'out/email-' + g + '.png', fullPage: true });
  console.log('shot', g);
}
await browser.close();
