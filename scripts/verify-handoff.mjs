/**
 * End-to-end check of the homepage universal dropzone.
 *
 * Drop a file on the homepage → it should route to the correct tool for that
 * format AND arrive with the file already loaded and processed. Both halves
 * matter: routing to the right page with an empty dropzone would be a worse
 * experience than not having the feature.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4321;
const BASE = `http://localhost:${PORT}`;
const FIX = join(root, 'tests/fixtures');

/* ── Server ──────────────────────────────────────────────────────────────────
 * Started and stopped here, so `npm run verify:handoff` works on its own
 * rather than silently depending on a server someone left running.
 *
 * `astro preview` daemonises, so killing the child process does not stop it —
 * the explicit `preview stop` before and after is what actually frees the port.
 */
const astro = (args) =>
  new Promise((resolve) => {
    const p = spawn('npx', ['astro', ...args], { cwd: root, stdio: 'ignore' });
    p.on('exit', resolve);
    p.on('error', resolve);
  });

async function startServer() {
  await astro(['preview', 'stop']);
  spawn('npx', ['astro', 'preview', '--port', String(PORT)], { cwd: root, stdio: 'ignore' });
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(BASE + '/')).ok) return;
    } catch {
      /* waiting */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('Preview server did not start');
}

console.log(`Starting preview server on ${BASE} …\n`);
await startServer();

const CASES = [
  ['photo-plain.jpg', '/compress-jpg/', 'JPEG → JPG compressor'],
  ['photo.png', '/compress-png/', 'PNG → PNG compressor'],
  ['graphic.webp', '/compress-webp/', 'WebP → WebP compressor'],
  ['photo.heic', '/heic-to-jpg/', 'HEIC → converter, not a compressor'],
  // A .jpg extension on PNG bytes. Routing must follow the magic bytes, not
  // the filename — this is the case that proves sniffing is real.
  ['mislabelled.jpg', '/compress-png/', 'PNG bytes named .jpg → PNG compressor'],
];

const browser = await chromium.launch();
let pass = 0;
let fail = 0;

const check = (name, ok, detail = '') => {
  console.log(`[${ok ? '  ok  ' : ' FAIL '}] ${name}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};

for (const [file, expectPath, label] of CASES) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.setInputFiles('.udrop input[type=file]', join(FIX, file));

  try {
    await page.waitForURL((u) => u.pathname === expectPath, { timeout: 30_000 });
    check(`ROUTE ${label}`, true, page.url().replace(BASE, ''));
  } catch {
    check(`ROUTE ${label}`, false, `landed on ${new URL(page.url()).pathname}`);
    await ctx.close();
    continue;
  }

  // The real proof: the file arrived and the tool processed it.
  try {
    await page.waitForSelector('.result-row__meta:has-text("→")', { timeout: 180_000 });
    const meta = await page.textContent('.result-row__meta');
    check(`FILE arrived and processed (${file})`, true, meta.trim());
  } catch {
    check(`FILE arrived and processed (${file})`, false, 'no result row appeared');
  }

  // The handoff marker must be stripped, so a refresh cannot try to re-consume
  // a file that has already been taken, and the URL someone copies is the
  // clean canonical one. Checked AFTER processing: the cleanup happens in the
  // same effect that picks the file up, so asserting it the instant the URL
  // changes just races hydration.
  check(`URL cleaned of ?from=drop (${file})`, !page.url().includes('from=drop'), page.url().replace(BASE, ''));

  check(`no page errors (${file})`, errors.length === 0, errors[0] ?? '');
  await ctx.close();
}

// A tool page opened directly must not try to consume a stale handoff.
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.setInputFiles('.udrop input[type=file]', join(FIX, 'photo-plain.jpg'));
  await page.waitForURL((u) => u.pathname === '/compress-jpg/', { timeout: 30_000 });
  await page.waitForSelector('.result-row__meta:has-text("→")', { timeout: 180_000 });

  // Navigate to a different tool WITHOUT the marker: nothing should load.
  await page.goto(BASE + '/compress-png/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const rows = await page.locator('.result-row').count();
  check('a stale handoff is not re-consumed on a later page', rows === 0, `${rows} rows`);
  await ctx.close();
}

await browser.close();
await astro(['preview', 'stop']);

console.log(`\n${pass}/${pass + fail} handoff checks passed`);
process.exit(fail ? 1 : 0);
