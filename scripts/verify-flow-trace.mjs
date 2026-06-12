/**
 * Smoke test for the flow trace (play button): traced nodes pulse, traced
 * arrows animate, the rest of the board spotlight-dims, only one trace runs
 * at a time, and read models have no play button.
 *
 * Fixture topology:
 *   screen1 -> command1 -> event1 -> readmodel1
 *                          event2 -> readmodel1
 *   screen2 -> command2
 *
 * Usage: node scripts/verify-flow-trace.mjs (expects `vite preview` on :4173)
 */
import { writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FIXTURE_PATH = '/tmp/em-trace-fixture.json';

const el = (id, type, x, y, label) => ({ id, type, position: { x, y }, data: { label } });
const edge = (id, source, target) => ({ id, source, target, sourceHandle: 'right', targetHandle: 'left' });

writeFileSync(
  FIXTURE_PATH,
  JSON.stringify({
    contexts: ['default'],
    nodes: [
      el('screen1', 'screen', 0, 0, 'Screen 1'),
      el('command1', 'command', 250, 0, 'Command 1'),
      el('event1', 'event', 500, 0, 'Event 1'),
      el('event2', 'event', 500, 200, 'Event 2'),
      el('readmodel1', 'readmodel', 750, 100, 'Read Model 1'),
      el('screen2', 'screen', 0, 400, 'Screen 2'),
      el('command2', 'command', 250, 400, 'Command 2'),
    ],
    edges: [
      edge('e1', 'screen1', 'command1'),
      edge('e2', 'command1', 'event1'),
      edge('e3', 'event1', 'readmodel1'),
      edge('e4', 'event2', 'readmodel1'),
      edge('e5', 'screen2', 'command2'),
    ],
  }),
);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--window-size=1440,900'],
});

const results = [];
function check(name, pass) {
  results.push([name, pass]);
  if (!pass) process.exitCode = 1;
}

try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle0' });
  await page.waitForSelector('.react-flow__node');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await wait(400);
  await (await page.$('input[type="file"]')).uploadFile(FIXTURE_PATH);
  await page.waitForSelector('[data-id="event2"]');
  await wait(400);

  const pulsingNodes = () =>
    page.$$eval('.react-flow__node', (nodes) =>
      nodes.filter((n) => n.querySelector('.flow-trace-pulse')).map((n) => n.getAttribute('data-id')).sort(),
    );
  const dimmedNodes = () =>
    page.$$eval('.react-flow__node', (nodes) =>
      nodes
        .filter((n) => n.querySelector('.group')?.className.includes('opacity-25'))
        .map((n) => n.getAttribute('data-id'))
        .sort(),
    );
  const tracedEdges = () =>
    page.$$eval('.react-flow__edge', (edges) =>
      edges
        .filter((e) => e.classList.contains('trace-edge') && e.classList.contains('animated'))
        .map((e) => e.getAttribute('data-id'))
        .sort(),
    );
  const hoverNode = async (id) => {
    const b = await (await page.$(`[data-id="${id}"]`)).boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + 14);
    await wait(200);
  };
  const clickButton = async (nodeId, title) => {
    await hoverNode(nodeId);
    await page.click(`[data-id="${nodeId}"] button[title="${title}"]`);
    await wait(300);
  };

  // 1. Read models have no play button; screens do.
  await hoverNode('readmodel1');
  check('readmodel has no play button', (await page.$('[data-id="readmodel1"] button[title="Play data flow"]')) === null);
  await hoverNode('screen1');
  check('screen has a play button', (await page.$('[data-id="screen1"] button[title="Play data flow"]')) !== null);

  // 2. Play on screen1: its whole downstream chain pulses, traced edges
  //    animate, everything else dims.
  await clickButton('screen1', 'Play data flow');
  check(
    'trace from screen1 pulses full chain',
    JSON.stringify(await pulsingNodes()) === JSON.stringify(['command1', 'event1', 'readmodel1', 'screen1']),
  );
  check(
    'non-flow elements spotlight-dimmed',
    JSON.stringify(await dimmedNodes()) === JSON.stringify(['command2', 'event2', 'screen2']),
  );
  check('traced edges animate', JSON.stringify(await tracedEdges()) === JSON.stringify(['e1', 'e2', 'e3']));
  await page.mouse.move(1200, 800); // unhover: stop button must stay visible
  await wait(300);
  const stopVisible = await page.$eval('[data-id="screen1"] button[title="Stop data flow"]', (btn) => {
    const span = btn.closest('span');
    return getComputedStyle(span).opacity === '1';
  });
  check('stop button stays visible without hover', stopVisible);
  await page.screenshot({ path: '/tmp/em-trace-screen1.png' });

  // 3. Play on event2: single-trace switch.
  await clickButton('event2', 'Play data flow');
  check(
    'trace switches to event2 flow',
    JSON.stringify(await pulsingNodes()) === JSON.stringify(['event2', 'readmodel1']),
  );
  check('e4 animates, screen1 chain dimmed', JSON.stringify(await tracedEdges()) === JSON.stringify(['e4']));
  check(
    'previous flow now dimmed',
    JSON.stringify(await dimmedNodes()) === JSON.stringify(['command1', 'command2', 'event1', 'screen1', 'screen2']),
  );
  await page.screenshot({ path: '/tmp/em-trace-event2.png' });

  // 4. Stop: everything returns to normal.
  await clickButton('event2', 'Stop data flow');
  check('no pulses after stop', (await pulsingNodes()).length === 0);
  check('no dims after stop', (await dimmedNodes()).length === 0);
  check('no animated edges after stop', (await tracedEdges()).length === 0);
} finally {
  await browser.close();
}

for (const [name, pass] of results) console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`);
