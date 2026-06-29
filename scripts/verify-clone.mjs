/**
 * Smoke test for element/slice cloning. Seeds a board (a slice with two
 * connected children, plus a floating element) into localStorage, then checks:
 *  - the slice copy button duplicates the slice + its children + the arrow
 *    between them, while dropping the arrow that points outside the slice;
 *  - the element copy button duplicates a lone element with no arrows;
 *  - Cmd/Ctrl+C then +V pastes the current selection.
 *
 * Usage: node scripts/verify-clone.mjs (expects `vite preview` on :4173)
 */
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Two connected children inside a slice, and a floating element wired from a child.
const SEED = {
  nodes: [
    { id: 'slice_test', type: 'slice', position: { x: 100, y: 100 }, data: { label: 'Test Slice', columns: 3, lanes: ['A', 'B', 'C', 'D'] } },
    { id: 'command_a', type: 'command', parentId: 'slice_test', position: { x: 44, y: 58 }, data: { label: 'Cmd A' } },
    { id: 'event_b', type: 'event', parentId: 'slice_test', position: { x: 244, y: 354 }, data: { label: 'Evt B' } },
    { id: 'command_float', type: 'command', position: { x: 900, y: 200 }, data: { label: 'Floating' } },
  ],
  edges: [
    { id: 'e_internal', source: 'command_a', target: 'event_b' },
    { id: 'e_external', source: 'event_b', target: 'command_float' },
  ],
  viewport: { x: 0, y: 0, zoom: 0.6 },
  contexts: ['default'],
  customTypes: [],
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--window-size=1440,900'],
});

const results = [];
const check = (name, pass) => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} : ${name}`);
};

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:4173/event-modeling/', { waitUntil: 'networkidle0' });

  // Seed the board and reload so the app rehydrates from localStorage.
  await page.evaluate((seed) => {
    localStorage.setItem('event-modeller:board', JSON.stringify(seed));
  }, SEED);
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-id="slice_test"]');

  const counts = () =>
    page.evaluate(() => ({
      nodes: document.querySelectorAll('.react-flow__node').length,
      edges: document.querySelectorAll('.react-flow__edge').length,
    }));

  const base = await counts();
  check('seed has 4 nodes', base.nodes === 4);
  check('seed has 2 edges', base.edges === 2);

  // --- Duplicate the slice via its copy button ---
  await page.hover('[data-id="slice_test"]');
  await page.click('[data-id="slice_test"] [aria-label="Duplicate slice"]');
  await new Promise((r) => setTimeout(r, 200));
  const afterSlice = await counts();
  check('slice clone adds slice + 2 children (4 -> 7)', afterSlice.nodes === base.nodes + 3);
  check('slice clone copies only the internal arrow (2 -> 3)', afterSlice.edges === base.edges + 1);

  // --- Duplicate the floating element via its copy button ---
  await page.hover('[data-id="command_float"]');
  await page.click('[data-id="command_float"] [aria-label="Duplicate element"]');
  await new Promise((r) => setTimeout(r, 200));
  const afterElement = await counts();
  check('element clone adds one node', afterElement.nodes === afterSlice.nodes + 1);
  check('element clone adds no arrow', afterElement.edges === afterSlice.edges);

  // --- Keyboard copy / paste of a single selected element ---
  await page.click('[data-id="command_float"]'); // select it
  await new Promise((r) => setTimeout(r, 100));
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.down(mod);
  await page.keyboard.press('c');
  await page.keyboard.press('v');
  await page.keyboard.up(mod);
  await new Promise((r) => setTimeout(r, 200));
  const afterPaste = await counts();
  check('Cmd/Ctrl+C then +V pastes one node', afterPaste.nodes === afterElement.nodes + 1);
  check('paste of a lone element adds no arrow', afterPaste.edges === afterElement.edges);

  await page.screenshot({ path: '/tmp/em-clone.png' });
} finally {
  await browser.close();
}

if (results.some((r) => !r.pass)) process.exitCode = 1;
