// Screenshot evidence for the Brightwood Glade re-spacing (zone1.ts camps + the
// Ranger Elwyn post). Boots an offline god-moded hunter, lifts the camera high
// for a wide framing, and captures: (1) the spread-out glade from the south,
// (2) Ranger Elwyn standing in his cleared buffer ahead of the treeline.
//
// Needs `npm run dev` on :5173 (override with GAME_URL). Writes PNGs to tmp/.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { BROWSER_PATH } from './browser_path.mjs';

const URL = process.env.GAME_URL ?? 'http://localhost:5173';
fs.mkdirSync('tmp', { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: BROWSER_PATH,
  headless: 'new',
  args: ['--window-size=1600,1200', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  defaultViewport: { width: 1600, height: 1200 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
await page.evaluate(() => document.querySelector('#btn-offline').click());
await sleep(200);
await page.evaluate(() => {
  const n = document.querySelector('#char-name');
  if (n) { n.value = 'Gladewatch'; n.dispatchEvent(new Event('input', { bubbles: true })); }
});
await page.click('#offline-select .mini-class[data-class="hunter"]');
await page.click('#btn-start-offline');
await page.waitForFunction(() => window.__game?.sim?.player, { timeout: 30000 });
await sleep(1500);

const place = (x, z, pitch, dist) => page.evaluate((args) => {
  const g = window.__game;
  const p = g.sim.player;
  g.sim.setPlayerLevel(10, p.id);
  p.gm = true; p.maxHp = 99999; p.hp = 99999; p.maxMp = 99999; p.mp = 99999;
  p.pos.x = args.x; p.pos.z = args.z; p.prevPos = { ...p.pos };
  g.input.camYaw = 0; g.input.camPitch = args.pitch;
  if (g.input.camDist !== undefined) g.input.camDist = args.dist;
}, { x, z, pitch, dist });

// 1) Stand at the south frontier and look north across the whole spread glade.
await place(30, 110, 0.62, 60);
await sleep(2500);
await page.screenshot({ path: 'tmp/brightwood_spread.png' });

// 2) Ranger Elwyn in his cleared buffer (he sits at x=35, z=105). Drop in just
//    south of him and look north so both the warden and the open ground read.
await place(35, 92, 0.40, 26);
await sleep(2500);
await page.screenshot({ path: 'tmp/ranger_elwyn_clearing.png' });

await browser.close();
console.log('wrote tmp/brightwood_spread.png and tmp/ranger_elwyn_clearing.png');
