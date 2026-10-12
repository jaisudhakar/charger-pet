// Renders the GNOME extension's cat animation frames from the 3D cat model.
// Needs Playwright (`npm i -D playwright`) and the dev server (`npm start`):
//   node scripts/render-cat-frames.mjs [http://localhost:8080]
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = process.argv[2] ?? 'http://localhost:8080';
const outDir = fileURLToPath(new URL('../gnome-extension/charger-cat@jaisudhakar.github.io/frames/', import.meta.url));
const LOOPS = { run: 8, sit: 24 };

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error(e));
await page.goto(`${base}/gnome-extension/tools/frames.html`);
await page.waitForFunction(() => window.ready);
const coats = await page.evaluate(() => window.coats);
for (const coat of coats) {
  await mkdir(`${outDir}${coat}`, { recursive: true });
  for (const [kind, n] of Object.entries(LOOPS)) {
    const urls = await page.evaluate(([c, k, n]) => window.renderFrames(c, k, n), [coat, kind, n]);
    await Promise.all(urls.map((u, i) => writeFile(`${outDir}${coat}/${kind}-${i}.png`, Buffer.from(u.split(',')[1], 'base64'))));
    console.log(`${coat}: ${urls.length} ${kind} frames`);
  }
}
await browser.close();
