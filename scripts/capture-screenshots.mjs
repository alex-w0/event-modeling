/**
 * Captures README screenshots of the main features into docs/screenshots/.
 *
 * Usage: node scripts/capture-screenshots.mjs (expects `vite preview` on :4173)
 */
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'docs/screenshots';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--window-size=1600,1000'],
  defaultViewport: { width: 1600, height: 1000, deviceScaleFactor: 2 },
});

try {
  const page = await browser.newPage();
  await page.goto('http://localhost:4173/event-modeling/', { waitUntil: 'networkidle0' });
  await page.waitForSelector('.react-flow__node-screen');

  // Fit the seeded board into view for a clean overview shot.
  await page.$eval('[title="Fit view"], [aria-label="Fit view"]', (el) => el.click()).catch(() => {});
  await wait(600);

  // 1. Board overview — the slice grid with Screen → Command → Event → Read Model.
  await page.screenshot({ path: `${OUT}/board-overview.png` });
  console.log('captured board-overview.png');

  // 2. Wireframe editor — open it from the seeded screen node.
  await page.$eval('[title="Design screen UI"]', (el) => el.click());
  await page.waitForSelector('[aria-label="Wireframe editor"]');
  await wait(500);
  await page.screenshot({ path: `${OUT}/wireframe-editor.png` });
  console.log('captured wireframe-editor.png');

  // Close the editor.
  await page.evaluate(() => {
    [...document.querySelectorAll('[aria-label="Wireframe editor"] button')]
      .find((b) => b.textContent.trim() === 'Save')
      ?.click();
  });
  await wait(400);
} finally {
  await browser.close();
}
