// Renders all cat sprite frames into sprites/<coat>/ and the app icons into app/icons/.
// Needs Playwright with Chromium:  npm i -D playwright && npx playwright install chromium
//   npm run sprites
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { ANIMS, DIRECTIONS, COATS } from '../../shared/brain.js';

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript' };

// Tiny static server so the page can import three.js and shared/brain.js.
const server = createServer(async (req, res) => {
  const file = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!file.startsWith(root + sep)) return res.writeHead(403).end();
  try {
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const port = server.address().port;

const save = (path, dataUrl) => writeFile(path, Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error(e));
page.on('console', (m) => { if (m.type() === 'error') console.error(m.text()); });
await page.goto(`http://localhost:${port}/tools/sprites/index.html`);
await page.waitForFunction(() => window.ready);

for (const coat of COATS) {
  const dir = join(root, 'sprites', coat);
  await mkdir(dir, { recursive: true });
  await page.evaluate((c) => window.setCoat(c), coat);
  let count = 0;
  for (const [anim, a] of Object.entries(ANIMS)) {
    for (const d of a.directional ? DIRECTIONS : [null]) {
      const urls = await page.evaluate(([an, di]) => window.renderAnim(an, di), [anim, d]);
      const name = d ? `${anim}-${d}` : anim;
      await Promise.all(urls.map((u, i) => save(join(dir, `${name}-${i}.png`), u)));
      count += urls.length;
    }
  }
  console.log(`${coat}: ${count} frames`);
}

await page.evaluate(() => window.setCoat('ginger'));
await mkdir(join(root, 'app', 'icons'), { recursive: true });
for (const [name, size] of [['icon.png', 512], ['tray.png', 22], ['tray@2x.png', 44], ['tray-win.png', 32]]) {
  await save(join(root, 'app', 'icons', name), await page.evaluate((s) => window.renderIcon(s), size));
}
console.log('icons done');

await browser.close();
server.close();
