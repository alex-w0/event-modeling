/**
 * Captures the DCB-contexts and flow-trace README screenshots into
 * docs/screenshots/. Imports a fixture board (no seed needed), then shoots
 * the contexts highlight dropdown and the play-data-flow trace.
 *
 * Usage: node scripts/capture-feature-screenshots.mjs (expects `vite preview` on :4173)
 */
import { writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'docs/screenshots';
const FIXTURE = '/tmp/em-feature-fixture.json';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const ACCENT = { screen: '#e4e4e7', command: '#38bdf8', event: '#fb923c', readmodel: '#34d399' };
const node = (id, type, x, y, data) => ({ id, type, position: { x, y }, data });
const edge = (id, source, target, kind, sourceHandle = 'right', targetHandle = 'left') => ({
  id, source, target, sourceHandle, targetHandle,
  style: { stroke: ACCENT[kind] },
  markerEnd: { type: 'arrowclosed', width: 16, height: 16, color: ACCENT[kind] },
});

writeFileSync(FIXTURE, JSON.stringify({
  contexts: ['default', 'Cart', 'Ordering'],
  nodes: [
    node('screenA', 'screen', 0, 0, {
      label: 'Cart Page',
      wireframe: {
        width: 320, height: 220,
        elements: [
          { id: 'w1', kind: 'heading', x: 16, y: 12, w: 140, h: 20, text: 'Shopping Cart' },
          { id: 'w2', kind: 'image', x: 16, y: 44, w: 64, h: 50 },
          { id: 'w3', kind: 'text', x: 92, y: 48, w: 100, h: 14, text: 'Wireless Mouse' },
          { id: 'w4', kind: 'button', x: 210, y: 176, w: 94, h: 28, text: 'Checkout' },
        ],
        strokes: [],
      },
    }),
    node('cmdA', 'command', 270, 8, { label: 'Add Item', content: 'productId: Uuid\nquantity: Int' }),
    node('evtA', 'event', 540, 8, { label: 'Item Added', content: 'productId: Uuid\nquantity: Int', contexts: ['Cart'] }),
    node('rmA', 'readmodel', 810, 8, { label: 'Cart Items', content: 'items: CartItem[]\ntotal: Money' }),
    node('screenB', 'screen', 0, 300, { label: 'Checkout' }),
    node('cmdB', 'command', 270, 308, { label: 'Place Order', content: 'cartId: Uuid' }),
    node('evtB', 'event', 540, 308, { label: 'Order Placed', content: 'orderId: Uuid\ntotal: Money', contexts: ['Ordering'] }),
    node('rmB', 'readmodel', 810, 308, { label: 'Order Summary', content: 'orderId: Uuid\nstatus: String' }),
  ],
  edges: [
    edge('eA1', 'screenA', 'cmdA', 'screen'),
    edge('eA2', 'cmdA', 'evtA', 'command'),
    edge('eA3', 'evtA', 'rmA', 'event'),
    edge('eB1', 'screenB', 'cmdB', 'screen'),
    edge('eB2', 'cmdB', 'evtB', 'command'),
    edge('eB3', 'evtB', 'rmB', 'event'),
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
}));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--window-size=1600,1000'],
  defaultViewport: { width: 1600, height: 1000, deviceScaleFactor: 2 },
});

try {
  const page = await browser.newPage();
  await page.goto('http://localhost:4173/event-modeling/', { waitUntil: 'networkidle0' });
  await page.waitForSelector('.react-flow');
  await wait(400);
  await (await page.$('input[type="file"]')).uploadFile(FIXTURE);
  await page.waitForSelector('[data-id="evtB"]');
  await wait(400);
  await page.$eval('[title="Fit view"]', (el) => el.click());
  await wait(700);

  // 1. Flow trace — play the data flow from the Cart screen; its chain pulses
  //    and animates while the rest of the board spotlight-dims.
  await page.$eval('[data-id="screenA"] button[title="Play data flow"]', (el) => el.click());
  await page.mouse.move(1300, 850); // unhover so only the trace styling shows
  await wait(900);
  await page.screenshot({ path: `${OUT}/flow-trace.png` });
  console.log('captured flow-trace.png');

  // Stop the trace.
  await page.$eval('[data-id="screenA"] button[title="Stop data flow"]', (el) => el.click());
  await wait(400);

  // 2. DCB contexts — open the Contexts dropdown and highlight "Cart"; events
  //    outside it dim. Context tags show on the events themselves.
  await page.hover('button[title="Highlight contexts"]');
  await page.waitForSelector('button[title="Toggle highlight for Cart"]');
  await wait(200);
  await page.click('button[title="Toggle highlight for Cart"]');
  await wait(600);
  await page.screenshot({ path: `${OUT}/contexts.png` });
  console.log('captured contexts.png');
} finally {
  await browser.close();
}
