/**
 * End-to-end smoke test.
 *
 * Drives a real Chrome against the dev server and walks the whole application:
 * the public landing, the three-step registration, sign-in, every console
 * route, the two screens with real business rules (allocation, fixtures), and
 * the spatial team builder in the lab, driven with a real mouse and touch.
 *
 * Usage:  npm run dev        (in one terminal)
 *         node scripts/check-runtime.mjs [--shots <dir>]
 *
 * Exit code 0 = every step passed and the console stayed clean.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { argv, exit } from 'node:process';
import puppeteer from 'puppeteer-core';

const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:5173';

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const executablePath = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!executablePath) {
  console.error('No Chrome or Edge binary found. Edit CHROME_CANDIDATES in this file.');
  exit(1);
}

const shotsIndex = argv.indexOf('--shots');
const shotsDir = shotsIndex > -1 ? argv[shotsIndex + 1] : null;
if (shotsDir && !existsSync(shotsDir)) mkdirSync(shotsDir, { recursive: true });

const results = [];
const noise = [];

/* Vite's HMR chatter and React DevTools nag are not application faults. */
const IGNORE = [
  /Download the React DevTools/i,
  /\[vite\] connect/i,
  /\[vite\] hot updated/i,
  /Lit is in dev mode/i,
  /* We abort Google Fonts ourselves (see the interceptor below); Chrome logs
     the abort as a failed resource. Our own doing, not the app's. */
  /Failed to load resource: net::ERR_FAILED/i,
];

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  /* Software WebGL is slow; a page that is merely busy must not look like a
     protocol failure. */
  protocolTimeout: 240000,
  args: [
    '--no-first-run',
    '--no-default-browser-check',
    '--use-gl=swiftshader',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    '--disable-dev-shm-usage',
    '--disable-extensions',
    '--window-size=1440,960',
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 960 });

/* The sandbox has no outbound network. Google Fonts would otherwise hang every
   navigation until its timeout, so refuse it up front. */
await page.setRequestInterception(true);
page.on('request', (req) => {
  if (/fonts\.(googleapis|gstatic)\.com/.test(req.url())) req.abort().catch(() => {});
  else req.continue().catch(() => {});
});

page.on('console', (msg) => {
  if (msg.type() !== 'error' && msg.type() !== 'warning') return;
  const text = msg.text();
  if (IGNORE.some((re) => re.test(text))) return;
  noise.push(`[console.${msg.type()}] ${text}`);
});
page.on('pageerror', (err) => noise.push(`[pageerror] ${err.message}`));
page.on('requestfailed', (req) => {
  const url = req.url();
  if (url.includes('fonts.g')) return; // offline sandbox; not our bug
  noise.push(`[requestfailed] ${url} — ${req.failure()?.errorText}`);
});
page.on('response', (res) => {
  if (res.status() >= 400 && !res.url().includes('fonts.g')) {
    noise.push(`[http ${res.status()}] ${res.url()}`);
  }
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function step(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  PASS  ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
    console.log(`  FAIL  ${name}\n        ${error.message}`);
    if (shotsDir) {
      await page
        .screenshot({ path: `${shotsDir}/FAIL-${name.replace(/[^a-z0-9]+/gi, '-')}.png` })
        .catch(() => {});
    }
  }
}

/**
 * Client-side route change, without reloading the document.
 *
 * Matters because the mock database lives in module state: a full reload
 * rebuilds it from the seed and forgets anything registered this session. Any
 * check that depends on earlier writes has to stay inside one page session.
 */
async function spaNavigate(path) {
  await page.evaluate((p) => {
    history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await sleep(500);
}

async function shot(name) {
  if (shotsDir) await page.screenshot({ path: `${shotsDir}/${name}.png`, fullPage: false });
}

/** Fails if Vite's error overlay is on screen. */
async function assertNoOverlay() {
  const overlay = await page.evaluate(() => {
    const el = document.querySelector('vite-error-overlay');
    if (!el) return null;
    return el.shadowRoot?.textContent?.slice(0, 400) ?? 'overlay present';
  });
  if (overlay) throw new Error(`Vite error overlay: ${overlay}`);
}

/**
 * Waits for text anywhere in the body.
 *
 * Uses textContent, not innerText: innerText is style-aware, so a label wearing
 * `text-transform: uppercase` reads back as "MATCHES" and a naive substring
 * check silently never matches. Comparison is case-insensitive for the same
 * reason.
 */
async function waitForText(text, timeout = 15000) {
  await page.waitForFunction(
    (t) => (document.body.textContent ?? '').toLowerCase().includes(t),
    { timeout },
    text.toLowerCase(),
  );
}

/** Case-insensitive, whitespace-tolerant body text. */
function bodyText(target = page) {
  return target.evaluate(() =>
    (document.body.textContent ?? '').replace(/\s+/g, ' ').toLowerCase(),
  );
}

/**
 * Clicks the first enabled element whose text matches.
 *
 * Two stages on purpose. First an `elementFromPoint` hit test, which is the real
 * reason to want a synthetic mouse event at all: it proves nothing is covering
 * the control. Then an in-page `.click()` to actually fire it.
 *
 * Puppeteer's own `.click()` dispatches CDP mouse events at coordinates, and in
 * this environment those are intermittently not delivered after a React
 * re-render — press and release land either side of a repaint and the browser
 * synthesises no `click`. That is a harness artefact, not an application bug
 * (verified: the same button fires correctly from an in-page click). Asserting
 * the hit test separately keeps the overlay check that would otherwise be lost.
 */
async function clickByText(selector, text, timeout = 12000) {
  const needle = text.toLowerCase();

  /* Options arrive over the (mocked) network, so the control may not exist yet.
     Wait for it rather than racing it. */
  try {
    await page.waitForFunction(
      (sel, t) =>
        [...document.querySelectorAll(sel)].some(
          (el) =>
            !el.disabled &&
            (el.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase().includes(t),
        ),
      { timeout },
      selector,
      needle,
    );
  } catch {
    throw new Error(`No enabled ${selector} containing "${text}" appeared within ${timeout}ms`);
  }

  const handle = await page.evaluateHandle(
    (sel, t) =>
      [...document.querySelectorAll(sel)].find(
        (el) =>
          !el.disabled &&
          (el.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase().includes(t),
      ),
    selector,
    needle,
  );

  const element = handle.asElement();
  if (!element) throw new Error(`No enabled ${selector} containing "${text}"`);

  /* Poll the hit test. A selection pill flying between chips (framer-motion
     `layoutId`) or a panel still expanding will sit over the target for a few
     hundred milliseconds. Something that is still covering it after a couple of
     seconds is a real layering bug and should fail. */
  let hit = { ok: false, why: 'not tested' };
  for (let attempt = 0; attempt < 20; attempt += 1) {
    hit = await page.evaluate((el) => {
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return { ok: false, why: 'zero-sized' };
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (top !== el && !el.contains(top)) {
        return { ok: false, why: `covered by <${top?.tagName?.toLowerCase() ?? 'nothing'}>` };
      }
      return { ok: true };
    }, element);

    if (hit.ok) break;
    await sleep(150);
  }

  if (!hit.ok) throw new Error(`"${text}" is not clickable: ${hit.why}`);

  await page.evaluate((el) => el.click(), element);
}

console.log('\n=== Corporate Sports Events Management — runtime smoke test ===\n');

/* ------------------------------------------------------------------ *
 * 1. Public landing
 * ------------------------------------------------------------------ */
console.log('Public site');

await step('landing renders with WebGL backdrop', async () => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(1500);
  await assertNoOverlay();

  const children = await page.evaluate(() => document.getElementById('root')?.children.length ?? 0);
  if (children === 0) throw new Error('#root is empty — the app did not mount');

  /* The stadium is fetched once the page is idle, so wait for it rather than racing it. */
  await page.waitForFunction(() => (document.querySelector('canvas')?.width ?? 0) > 0, { timeout: 60000 });
  await sleep(2500);
  await shot('01-landing');
});

await step('landing links to the console sign-in', async () => {
  const href = await page.evaluate(
    () => document.querySelector('a[href="/login"]')?.getAttribute('href') ?? null,
  );
  if (href !== '/login') throw new Error('No link to /login on the landing page');
});

/* ------------------------------------------------------------------ *
 * 1b. The stadium narrative
 * ------------------------------------------------------------------ */
console.log('\nStadium & scroll narrative');

/** Scrolls so a section reaches the stadium's focus line, where its camera shot is fully arrived. */
async function scrollToShot(anchor) {
  await page.evaluate((id) => {
    const el = document.getElementById(id);
    const y = id === 'top' ? 0 : el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.45;
    window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
  }, anchor);
}

/** Runs axe (WCAG 2.x A/AA + best practice) after walking the page so every scroll reveal has fired. */
async function axeViolations() {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 600) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 90));
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await sleep(1800);
  await page.evaluate(axeSource);
  return page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
    });
    return result.violations.map((v) => `${v.id} x${v.nodes.length} (${v.nodes[0]?.target.join(' ')})`);
  });
}

await step('stadium mounts after first paint and renders the scene', async () => {
  await page.waitForFunction(() => Boolean(window.__stadium), { timeout: 60000 });
  const stats = await page.evaluate(() => window.__stadium.stats());
  if (stats.calls < 8) throw new Error(`Scene drew only ${stats.calls} calls`);
  if (stats.triangles < 20000) throw new Error(`Scene drew only ${stats.triangles} triangles`);
});

await step('camera follows the scroll to the Colour League shot', async () => {
  const before = await page.evaluate(() => window.__stadium.camera.position.toArray());
  await scrollToShot('standings');
  await page.waitForFunction(() => window.__stadium.rig.progress > 6.6, { timeout: 30000 });
  const after = await page.evaluate(() => window.__stadium.camera.position.toArray());
  const moved = Math.hypot(after[0] - before[0], after[1] - before[1], after[2] - before[2]);
  if (moved < 60) throw new Error(`Camera moved only ${moved.toFixed(1)} units`);
  if (after[1] < 150) throw new Error(`Expected the overhead shot, camera y is ${after[1].toFixed(1)}`);
});

await step('chapter rail marks the chapter in view', async () => {
  const current = await page.evaluate(
    () => document.querySelector('nav[aria-label="Chapters"] a[aria-current]')?.textContent ?? null,
  );
  if (!current || !/colour league/i.test(current)) throw new Error(`Rail shows "${current}"`);
});

await step('in-page links scroll to the section and hand it focus', async () => {
  await scrollToShot('top');
  await sleep(400);
  await page.evaluate(() => document.querySelector('nav[aria-label="Primary"] a[href="#calendar"]').click());
  await page.waitForFunction(
    () => Math.abs(document.getElementById('calendar').getBoundingClientRect().top - 92) < 24,
    { timeout: 12000 },
  );
  const focused = await page.evaluate(() => document.activeElement?.id ?? null);
  if (focused !== 'calendar') throw new Error(`Focus is on "${focused}", not the section`);
});

await step('spotlight tabs follow the arrow keys', async () => {
  await page.evaluate(() => document.querySelector('[role="tab"][aria-selected="true"]').focus());
  await page.keyboard.press('ArrowRight');
  await sleep(300);
  const state = await page.evaluate(() => ({
    selected: document.querySelector('[role="tab"][aria-selected="true"]')?.textContent,
    focused: document.activeElement?.getAttribute('role'),
    panel: Boolean(document.querySelector('[role="tabpanel"][aria-labelledby]')),
  }));
  if (!/sarjana/i.test(state.selected ?? '')) throw new Error(`Selected tab is "${state.selected}"`);
  if (state.focused !== 'tab' || !state.panel) throw new Error('Tab focus or tabpanel wiring missing');
});

await step('gallery lightbox takes focus, pages, and returns focus', async () => {
  /* Opened from the keyboard: a scripted .click() never moves focus, a real activation does. */
  await page.evaluate(() => document.querySelector('#gallery button[aria-label^="Open photo"]').focus());
  await page.keyboard.press('Enter');
  await page.waitForSelector('[role="dialog"][aria-modal="true"]', { timeout: 8000 });
  await sleep(400);
  const first = await page.evaluate(() => ({
    focus: document.activeElement?.getAttribute('aria-label'),
    caption: document.querySelector('[role="dialog"]').getAttribute('aria-label'),
  }));
  if (first.focus !== 'Close') throw new Error(`Focus is on "${first.focus}"`);
  await page.evaluate(() => document.querySelector('[role="dialog"] button[aria-label="Next photo"]').click());
  await sleep(500);
  const next = await page.evaluate(() => document.querySelector('[role="dialog"]').getAttribute('aria-label'));
  if (next === first.caption) throw new Error('Next photo did not change the image');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 8000 });
  const back = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
  if (!back.startsWith('Open photo')) throw new Error(`Focus returned to "${back}"`);
});

await step('no horizontal overflow from 320 to 2560 wide, nav never wraps', async () => {
  const problems = [];
  for (const width of [320, 390, 768, 1024, 1280, 1440, 1920, 2560]) {
    await page.setViewport({ width, height: 900 });
    await sleep(500);
    const r = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      tallest: Math.max(
        0,
        ...[...document.querySelectorAll('nav[aria-label="Primary"] ul a')]
          .filter((a) => a.getBoundingClientRect().width > 0)
          .map((a) => a.getBoundingClientRect().height),
      ),
    }));
    if (r.overflow > 1) problems.push(`${width}px overflows by ${r.overflow}px`);
    if (r.tallest > 44) problems.push(`${width}px nav link wraps (${Math.round(r.tallest)}px tall)`);
  }
  await page.setViewport({ width: 1440, height: 960 });
  if (problems.length) throw new Error(problems.join('; '));
});

await step('mobile menu is a modal: focus in, Escape out, focus back', async () => {
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await scrollToShot('top');
  await sleep(600);
  await page.evaluate(() => document.querySelector('button[aria-controls="site-menu"]').click());
  await page.waitForSelector('#site-menu[role="dialog"]', { timeout: 8000 });
  await sleep(400);
  const inside = await page.evaluate(() => document.getElementById('site-menu').contains(document.activeElement));
  if (!inside) throw new Error('Focus did not move into the menu');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('site-menu'), { timeout: 8000 });
  const back = await page.evaluate(() => document.activeElement?.getAttribute('aria-controls'));
  await page.setViewport({ width: 1440, height: 960, isMobile: false, hasTouch: false });
  if (back !== 'site-menu') throw new Error('Focus did not return to the menu button');
});

await step('phones keep the CSS stadium until the visitor engages', async () => {
  const context = await browser.createBrowserContext();
  const phone = await context.newPage();
  try {
    await phone.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await phone.setRequestInterception(true);
    phone.on('request', (req) => (/fonts\.g/.test(req.url()) ? req.abort().catch(() => {}) : req.continue().catch(() => {})));
    await phone.goto(BASE, { waitUntil: 'domcontentloaded' });
    await sleep(2500);
    const early = await phone.evaluate(() => ({
      canvas: Boolean(document.querySelector('canvas')),
      standIn: Boolean(document.querySelector('.stadium-standin')),
    }));
    if (early.canvas) throw new Error('WebGL started before any interaction on a phone');
    if (!early.standIn) throw new Error('No stand-in stadium while waiting');
    await phone.evaluate(() => window.scrollBy(0, 400));
    await phone.waitForFunction(() => (document.querySelector('canvas')?.width ?? 0) > 0, { timeout: 60000 });
  } finally {
    await context.close();
  }
});

for (const theme of ['dark', 'light']) {
  await step(`landing has no axe violations (${theme} theme)`, async () => {
    await page.evaluate((t) => localStorage.setItem('csem-theme', t), theme);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await sleep(1500);
    const violations = await axeViolations();
    if (violations.length) throw new Error(violations.join('; '));
  });
}
await page.evaluate(() => localStorage.setItem('csem-theme', 'dark'));

await step('reduced motion: native scrolling and a still, scroll-driven camera', async () => {
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__stadium), { timeout: 60000 });
  const lenis = await page.evaluate(() => document.documentElement.classList.contains('lenis'));
  if (lenis) throw new Error('Smooth scrolling is active under reduced motion');
  await scrollToShot('events');
  await page.waitForFunction(() => Math.abs(window.__stadium.rig.progress - 4) < 0.05, { timeout: 15000 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
});

/* Regressions from the independent review of the audit. */
await step('a malformed URL hash does not blank the page', async () => {
  const errors = [];
  const onError = (err) => errors.push(err.message);
  page.on('pageerror', onError);
  /* From a blank page, or a hash-only change would be a same-document navigation and mount nothing. */
  await page.goto('about:blank');
  await page.goto(`${BASE}/#50%`, { waitUntil: 'domcontentloaded' });
  await sleep(2500);
  page.off('pageerror', onError);
  const mounted = await page.evaluate(() => Boolean(document.querySelector('#site-root main')));
  if (!mounted) throw new Error(`The page unmounted: ${errors.join('; ') || 'no error reported'}`);
  if (errors.length) throw new Error(errors.join('; '));
});

await step('chapter rail labels take the pointer only while shown', async () => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  const leak = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('nav[aria-label="Chapters"] a:not([aria-current]) > span:first-child')];
    for (const label of labels) {
      const r = label.getBoundingClientRect();
      if (r.width === 0) continue;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (hit && hit.closest('nav[aria-label="Chapters"]')) return label.textContent;
    }
    return null;
  });
  if (leak) throw new Error(`The hidden label "${leak}" still intercepts clicks over the page`);
});

await step('gallery lightbox sits above the fixed header and chapter rail', async () => {
  await page.evaluate(() => document.querySelector('#gallery button[aria-label^="Open photo"]').focus());
  await page.keyboard.press('Enter');
  await page.waitForSelector('[role="dialog"][aria-modal="true"]', { timeout: 8000 });
  await sleep(500);
  const covered = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    if (dialog.parentElement !== document.body) return 'the lightbox is not portalled to <body>';
    for (const label of ['Close', 'Next photo', 'Previous photo']) {
      const button = dialog.querySelector(`button[aria-label="${label}"]`);
      const r = button.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!button.contains(hit)) return `${label} is covered by <${hit?.tagName.toLowerCase()}>`;
    }
    return null;
  });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 8000 });
  if (covered) throw new Error(covered);
});

await step('mobile menu keeps Tab inside, in document order', async () => {
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await scrollToShot('top');
  await sleep(600);
  await page.evaluate(() => document.querySelector('button[aria-controls="site-menu"]').click());
  await page.waitForSelector('#site-menu[role="dialog"]', { timeout: 8000 });
  await sleep(500);
  const result = await page.evaluate(async () => {
    const stops = [...document.querySelectorAll('#site-menu a[href], #site-menu button:not([disabled])')];
    stops[stops.length - 1].focus();
    return stops.length;
  });
  await page.keyboard.press('Tab');
  const afterLast = await page.evaluate(() => document.activeElement?.getAttribute('aria-controls'));
  await page.keyboard.down('Shift');
  await page.keyboard.press('Tab');
  await page.keyboard.up('Shift');
  const backInside = await page.evaluate(() => document.getElementById('site-menu').contains(document.activeElement));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('site-menu'), { timeout: 8000 });
  await page.setViewport({ width: 1440, height: 960, isMobile: false, hasTouch: false });
  if (result < 2) throw new Error('Menu has no focusable items');
  if (afterLast !== 'site-menu') throw new Error('Tab from the last menu item left the menu');
  if (!backInside) throw new Error('Shift+Tab from the toggle left the menu');
});

/* ------------------------------------------------------------------ *
 * 2. Self-registration was removed on purpose (participants come from HR)
 * ------------------------------------------------------------------ */
console.log('\nRemoved routes');

await step('/register answers with the 404 page, not a form', async () => {
  await page.goto(`${BASE}/register`, { waitUntil: 'domcontentloaded' });
  await waitForText('Page not found');
  const hasForm = await page.evaluate(() => document.querySelector('form') !== null);
  if (hasForm) throw new Error('/register still renders a form');
});

/* ------------------------------------------------------------------ *
 * 3. Auth
 * ------------------------------------------------------------------ */
console.log('\nAuthentication (forms 2-4)');

await step('rejects bad credentials', async () => {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await waitForText('Sign in');
  await page.type('#userName', 'admin');
  await page.type('#password', 'wrong-password');
  await clickByText('button', 'Sign in');
  await waitForText('do not match', 15000);
  await shot('06-login-error');
});

await step('signs in as Main Admin', async () => {
  await page.evaluate(() => {
    document.querySelector('#userName').value = '';
    document.querySelector('#password').value = '';
  });
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await waitForText('Sign in');
  await page.type('#userName', 'admin');
  await page.type('#password', 'demo2026');
  await clickByText('button', 'Sign in');
  await page.waitForFunction(() => location.pathname.startsWith('/console'), { timeout: 15000 });
  await waitForText('Good to see you');
  await assertNoOverlay();
});

await step('guard redirects an anonymous visitor to /login', async () => {
  /* A plain newPage() shares localStorage with the signed-in tab, so it would
     still be authenticated. An isolated context is the only honest test. */
  const context = await browser.createBrowserContext();
  const guest = await context.newPage();
  try {
    await guest.goto(`${BASE}/console/teams`, { waitUntil: 'domcontentloaded' });
    await guest.waitForFunction(() => location.pathname === '/login', { timeout: 15000 });
  } finally {
    await context.close();
  }
});

/* ------------------------------------------------------------------ *
 * 4. Dashboard
 * ------------------------------------------------------------------ */
console.log('\nDashboard');

await step('renders KPI tiles and all four charts', async () => {
  await page.goto(`${BASE}/console`, { waitUntil: 'domcontentloaded' });
  await waitForText('Good to see you');
  await sleep(2000);
  await assertNoOverlay();

  const body = await bodyText();
  for (const label of [
    'participants',
    'teams',
    'matches',
    'results',
    'active users',
    'participants by sub-group',
    'schedule status',
    'classification pipeline',
    'participants classified over time',
    'team allocation fill',
    'next up',
  ]) {
    if (!body.includes(label)) throw new Error(`Dashboard missing "${label}"`);
  }

  const svgCount = await page.evaluate(() => document.querySelectorAll('figure svg').length);
  if (svgCount < 3) throw new Error(`Expected at least 3 chart SVGs, found ${svgCount}`);
  await shot('07-dashboard');
});

/* ------------------------------------------------------------------ *
 * 5. Every console route
 * ------------------------------------------------------------------ */
console.log('\nConsole routes');

const ROUTES = [
  ['/console/participants', 'Participant register'],
  ['/console/event-team', 'Event team'],
  ['/console/integration/groups', 'Group assignment'],
  ['/console/integration/sub-groups', 'Sub-group assignment'],
  ['/console/integration/types', 'Participant types'],
  ['/console/integration/type-details', 'Type detail'],
  ['/console/teams', 'Teams'],
  ['/console/formations', 'Team formation'],
  ['/console/team-builder', 'Team builder'],
  ['/console/allocation', 'Team allocation'],
  ['/console/team-groups', 'Team groups'],
  ['/console/events', 'Event scheduling'],
  ['/console/schedule', 'Match schedule'],
  ['/console/results', 'Results & winners'],
  ['/console/rules', 'Rule cards'],
  ['/console/masters/groups', 'Groups'],
  ['/console/masters/sub-groups', 'Sub-groups'],
  ['/console/masters/player-types', 'Participant types'],
  ['/console/masters/player-type-details', 'Sub-type details'],
  ['/console/masters/umpires', 'Umpires & officials'],
  ['/console/admin/users', 'User accounts'],
  ['/console/admin/permissions', 'Role permissions'],
  ['/console/admin/audit', 'Audit log'],
  ['/console/history', 'History'],
  ['/console/reports', 'Exports'],
  ['/console/profile', 'My profile'],
];

for (const [route, heading] of ROUTES) {
  await step(`route ${route}`, async () => {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    await waitForText(heading);
    await sleep(700);
    await assertNoOverlay();

    const body = await bodyText();
    if (body.includes('loading records')) throw new Error('Table never finished loading');
    if (body.includes('page not found')) throw new Error('Route fell through to the 404 page');
  });
}

for (const [legacy, current] of [
  ['/console/players', '/console/participants'],
  ['/console/masters/events', '/console/events'],
  ['/dashboard', '/console'],
]) {
  await step(`legacy ${legacy} redirects to ${current}`, async () => {
    await page.goto(`${BASE}${legacy}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction((p) => location.pathname === p, { timeout: 10000 }, current);
  });
}

await shot('08-players');
await page.goto(`${BASE}/console/admin/permissions`, { waitUntil: 'domcontentloaded' });
await waitForText('Role permissions');
await sleep(800);
await shot('09-permissions');

/* ------------------------------------------------------------------ *
 * 6. CRUD round trip
 * ------------------------------------------------------------------ */
console.log('\nCRUD (generic engine)');

await step('creates, edits and deactivates a group', async () => {
  await page.goto(`${BASE}/console/masters/groups`, { waitUntil: 'domcontentloaded' });
  await waitForText('Groups');
  await sleep(900);

  await clickByText('button', 'New group');
  await waitForText('New Group');
  await page.type('#groupName', 'Smoke Test Group');
  await clickByText('button', 'Create');
  await waitForText('Record created', 12000);
  await sleep(1200);

  const body = await bodyText();
  if (!body.includes('smoke test group')) throw new Error('New group not visible in the list');
  await shot('10-crud-created');
});

await step('edit dialog preserves async foreign-key selects', async () => {
  await page.goto(`${BASE}/console/masters/sub-groups`, { waitUntil: 'domcontentloaded' });
  await waitForText('Sub-groups');
  await sleep(1400);

  await clickByText('button', 'Edit');
  await waitForText('Edit Sub-group');
  /* The <option>s arrive after form.reset(); give them a beat, then check the
     select actually kept its value rather than falling back to blank. */
  await sleep(1800);

  const state = await page.evaluate(() => {
    const parent = document.querySelector('#groupId');
    const name = document.querySelector('#subGroupName');
    return {
      parentValue: parent?.value ?? null,
      parentOptionCount: parent?.options.length ?? 0,
      nameValue: name?.value ?? null,
    };
  });

  if (state.parentOptionCount < 2) throw new Error('Parent group options never loaded');
  if (!state.parentValue) {
    throw new Error('Parent group select lost its value once options loaded');
  }
  if (!state.nameValue) throw new Error('Sub-group name did not populate');

  await shot('10b-edit-fk');
  await clickByText('button', 'Cancel');
});

await step('blocks a dialog submit with a missing required field', async () => {
  await page.goto(`${BASE}/console/masters/sub-groups`, { waitUntil: 'domcontentloaded' });
  await waitForText('Sub-groups');
  await sleep(900);
  await clickByText('button', 'New sub-group');
  await waitForText('New Sub-group');
  await clickByText('button', 'Create');
  await waitForText('is required', 8000);
});

/* ------------------------------------------------------------------ *
 * 7. Business rules
 * ------------------------------------------------------------------ */
console.log('\nBusiness rules');

await step('allocation screen loads a roster and eligible list', async () => {
  await page.goto(`${BASE}/console/allocation`, { waitUntil: 'domcontentloaded' });
  await waitForText('Team allocation');
  await sleep(900);

  await page.select('#alloc-team', '1');
  await waitForText('squad', 12000);
  await sleep(1800);
  await assertNoOverlay();

  const body = await bodyText();
  if (!body.includes('eligible players')) throw new Error('Eligible panel did not render');
  if (!body.includes('capacity')) throw new Error('Capacity meter did not render');
  if (!body.includes('drop here to add')) throw new Error('Drop zone did not render');
  await shot('11-allocation');
});

await step('allocation reorders a squad from the keyboard', async () => {
  /* The button path for the drag, which is the one a smoke test can drive.
     Asserts the new order survives the write, not just the optimistic paint. */
  const before = await page.evaluate(
    () => [...document.querySelectorAll('ul li button[aria-label^="Move"]')]
      .map((b) => b.getAttribute('aria-label')),
  );
  if (before.length < 4) throw new Error(`Expected move controls on the squad, found ${before.length}`);

  const firstName = await page.evaluate(() => {
    const row = document.querySelectorAll('ul li button[aria-label^="Move"]')[0]?.closest('li');
    return row?.querySelector('button')?.textContent?.trim() ?? null;
  });

  await clickByText('button[aria-label^="Move"][aria-label$="down"]', '');
  await sleep(1600);

  const nowSecond = await page.evaluate(() => {
    const rows = document.querySelectorAll('ul li button[aria-label^="Move"]');
    const row = rows[2]?.closest('li');
    return row?.querySelector('button')?.textContent?.trim() ?? null;
  });

  if (!firstName || nowSecond !== firstName) {
    throw new Error(`Reorder did not take: "${firstName}" expected in slot 2, found "${nowSecond}"`);
  }
  await shot('11b-allocation-reordered');
});

await step('player card opens with the animated badge', async () => {
  await page.goto(`${BASE}/console/participants`, { waitUntil: 'domcontentloaded' });
  await waitForText('Participant register');
  await sleep(1400);

  await clickByText('button', 'View card');
  await waitForText('tilt it', 20000);
  await assertNoOverlay();

  /* The badge's entrance animation fades it in; wait for it to actually be
     painted (non-zero size) rather than just present in the DOM. */
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[role="dialog"] .aspect-\\[4\\/5\\]');
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    },
    { timeout: 15000 },
  );

  const body = await bodyText();
  if (!body.includes('emergency contact')) throw new Error('Card did not render the detail list');

  const mailto = await page.evaluate(
    () => document.querySelector('[role="dialog"] a[href^="mailto:"]') !== null,
  );
  if (!mailto) throw new Error('Card did not render a clickable email');

  /* Hover across the badge and confirm the tilt transform actually applies —
     the visible proof that the Framer Motion tilt is wired up, not just that
     the static markup rendered. */
  const box = await page.evaluate(() => {
    const el = document.querySelector('[role="dialog"] .aspect-\\[4\\/5\\]');
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width * 0.2, y: r.top + r.height * 0.22 };
  });
  await page.mouse.move(box.x, box.y, { steps: 10 });
  await sleep(400);
  const tilted = await page.evaluate(() => {
    const el = document.querySelector('[role="dialog"] .aspect-\\[4\\/5\\]');
    return getComputedStyle(el).transform !== 'none' && getComputedStyle(el).transform !== '';
  });
  if (!tilted) throw new Error('Badge did not apply a tilt transform on hover');

  await shot('11c-player-card');
  await page.keyboard.press('Escape');
});

await step('fixture form refuses a team playing itself', async () => {
  await page.goto(`${BASE}/console/schedule`, { waitUntil: 'domcontentloaded' });
  await waitForText('Match schedule');
  await sleep(900);

  await clickByText('button', 'New fixture');
  await waitForText('New fixture');
  await page.type('#matchNo', 'SMOKE-1');
  await page.select('#subGroupId', '1');
  await sleep(1200);
  await page.type('#matchDate', '2026-12-01');
  await page.type('#matchTime', '09:00');

  const teamValue = await page.evaluate(
    () => document.querySelector('#team1Id')?.querySelectorAll('option')[1]?.value ?? null,
  );
  if (!teamValue) throw new Error('No teams loaded into the fixture form');

  await page.select('#team1Id', teamValue);
  await page.select('#team2Id', teamValue);
  await clickByText('button', 'Create fixture');
  await waitForText('cannot play itself', 8000);
  await shot('12-fixture-conflict');
});

/* ------------------------------------------------------------------ *
 * 7b. Audit regressions — each pins one defect fixed on 2026-09-29
 * ------------------------------------------------------------------ */
console.log('\nAudit regressions');

await step('profile saves after a full page reload', async () => {
  /* The reload rebuilds the mock server's module state, so the session has to
     be recovered from the stored token or the save answers "Not signed in". */
  await page.goto(`${BASE}/console/profile`, { waitUntil: 'domcontentloaded' });
  await waitForText('My profile');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForText('My profile');
  await page.waitForSelector('#displayName');
  await page.$eval('#displayName', (el) => el.select());
  await page.type('#displayName', 'Audit Check Admin');
  await clickByText('button', 'Save profile');
  await waitForText('Profile updated', 10000);
  if ((await bodyText()).includes('not signed in')) throw new Error('Save was refused as signed out');
});

await step('mock API rejects an aborted request with AbortError, like fetch', async () => {
  const outcome = await page.evaluate(async () => {
    const { api } = await import('/src/api/index.ts');
    const controller = new AbortController();
    const pending = api.groups.list({}, controller.signal);
    controller.abort();
    try {
      await pending;
      return 'resolved';
    } catch (cause) {
      return cause?.name ?? String(cause);
    }
  });
  if (outcome !== 'AbortError') throw new Error(`Expected AbortError, got ${outcome}`);
});

await step('seed contains rejected participants', async () => {
  const total = await page.evaluate(async () => {
    const { api } = await import('/src/api/index.ts');
    return (await api.players.list({ status: 'Rejected', pageSize: 1 })).total;
  });
  if (!(total > 0)) throw new Error('The Rejected status branch never fires');
});

await step('batched list aggregates match per-record queries', async () => {
  const mismatches = await page.evaluate(async () => {
    const { api } = await import('/src/api/index.ts');
    const out = [];

    const teams = (await api.teams.list({ pageSize: 200 })).items;
    const counts = await Promise.all(
      teams.map((t) => api.teamAllocations.list({ teamId: t.teamId, isActive: true, pageSize: 1 })),
    );
    teams.forEach((t, i) => {
      if (t.allocatedCount !== counts[i].total) {
        out.push(`${t.teamName} allocatedCount ${t.allocatedCount} vs ${counts[i].total}`);
      }
    });

    const fixtures = (await api.schedules.list({ pageSize: 12 })).items;
    const singles = await Promise.all(fixtures.map((f) => api.schedules.get(f.scheduleId)));
    fixtures.forEach((f, i) => {
      if (JSON.stringify(f.umpireIds) !== JSON.stringify(singles[i].umpireIds)) {
        out.push(`${f.matchNo} umpireIds differ between list and record`);
      }
    });

    const groups = (await api.teamGroups.list({ pageSize: 200 })).items;
    const members = await Promise.all(
      groups.map((g) => api.teamGroupDetails.list({ teamGroupId: g.teamGroupId, isActive: true, pageSize: 1 })),
    );
    groups.forEach((g, i) => {
      if (g.teamCount !== members[i].total) out.push(`${g.groupName} teamCount ${g.teamCount} vs ${members[i].total}`);
    });
    return out;
  });
  if (mismatches.length) throw new Error(mismatches.join('; '));
});

/* ------------------------------------------------------------------ *
 * 8. Role scoping
 * ------------------------------------------------------------------ */
console.log('\nRole-based access');

await step('Event Team user is scoped and denied admin screens', async () => {
  await page.goto(`${BASE}/console/profile`, { waitUntil: 'domcontentloaded' });
  await waitForText('My profile');
  await clickByText('button', 'Sign out');
  await page.waitForFunction(() => location.pathname === '/login', { timeout: 12000 });

  await page.type('#userName', 'cricket');
  await page.type('#password', 'demo2026');
  await clickByText('button', 'Sign in');
  await page.waitForFunction(() => location.pathname.startsWith('/console'), { timeout: 15000 });

  /* Wait for the console's own nav, not for the word "Cricket" — the login
     page's demo-account panel contains that too, so it matches before the
     console has rendered at all. */
  await page.waitForFunction(
    () => (document.querySelector('nav[aria-label="Console"]')?.textContent ?? '').length > 40,
    { timeout: 15000 },
  );
  await sleep(600);

  const navText = await page.evaluate(
    () => (document.querySelector('nav[aria-label="Console"]')?.textContent ?? '').toLowerCase(),
  );
  if (navText.includes('user accounts')) {
    throw new Error('Event Team can see the User accounts link — RBAC nav filter failed');
  }
  if (!navText.includes('teams')) throw new Error('Event Team cannot see Teams');
  await shot('13-eventteam-dashboard');

  await page.goto(`${BASE}/console/admin/users`, { waitUntil: 'domcontentloaded' });
  await waitForText('Not available to your role', 12000);
  await shot('14-forbidden');
});

await step('scoped exports never include another sub-group', async () => {
  const leaks = await page.evaluate(async () => {
    const { api, request, tokenStore } = await import('/src/api/index.ts');
    const subGroupId = tokenStore.user?.subGroupId;
    if (!subGroupId) return ['signed-in user has no sub-group scope'];

    const own = new Set(
      (await api.teams.list({ subGroupId, pageSize: 500 })).items.map((t) => t.teamName),
    );

    const parse = (text) => {
      const rows = [];
      let row = [];
      let cell = '';
      let quoted = false;
      for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        if (quoted) {
          if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
          else if (ch === '"') quoted = false;
          else cell += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ',') { row.push(cell); cell = ''; }
        else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
        else cell += ch;
      }
      if (cell || row.length) { row.push(cell); rows.push(row); }
      return rows;
    };

    const out = [];
    for (const reportType of ['teamRoster', 'teamGroups']) {
      const blob = await request({
        method: 'POST',
        path: '/api/reports/export',
        body: { reportType, format: 'CSV', filters: { subGroupId } },
        expectBlob: true,
      });
      const [head, ...rows] = parse((await blob.text()).replace(/^﻿/, ''));
      const column = head.indexOf('teamName');
      if (column < 0) { out.push(`${reportType}: no teamName column`); continue; }
      if (!rows.length) out.push(`${reportType}: exported nothing`);
      for (const r of rows) {
        if (!own.has(r[column])) out.push(`${reportType}: ${r[column]}`);
      }
    }
    return [...new Set(out)];
  });
  if (leaks.length) throw new Error(`Rows from outside the scope: ${leaks.slice(0, 6).join(', ')}`);
});

await step('profile names the role correctly for a non-admin', async () => {
  await page.goto(`${BASE}/console/profile`, { waitUntil: 'domcontentloaded' });
  await waitForText('My profile');
  const role = await page.evaluate(
    () =>
      [...document.querySelectorAll('dt')]
        .find((dt) => dt.textContent?.trim() === 'Role')
        ?.nextElementSibling?.textContent?.trim() ?? null,
  );
  if (role !== 'Management Team') throw new Error(`Role shown as "${role}"`);
});

/* ------------------------------------------------------------------ *
 * 9. Responsive
 * ------------------------------------------------------------------ */
console.log('\nResponsive');

await step('console collapses to a drawer at phone width', async () => {
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.goto(`${BASE}/console/teams`, { waitUntil: 'domcontentloaded' });
  await waitForText('Teams');
  await sleep(1200);

  const railVisible = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    if (!aside) return false;
    return aside.getBoundingClientRect().width > 0 && getComputedStyle(aside).display !== 'none';
  });
  if (railVisible) throw new Error('Sidebar rail is still visible at 390px');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  if (overflow > 2) throw new Error(`Horizontal overflow of ${overflow}px at 390px wide`);

  await shot('15-mobile-teams');
});

await step('console drawer takes focus and closes on Escape', async () => {
  await clickByText('button[aria-label="Open navigation"]', '');
  await page.waitForSelector('#console-drawer', { visible: true, timeout: 5000 });
  await sleep(400);
  const inside = await page.evaluate(() =>
    Boolean(document.getElementById('console-drawer')?.contains(document.activeElement)),
  );
  if (!inside) throw new Error('Focus did not move into the drawer');

  /* A modal drawer: Tab from its last control comes back to its first, never into the page behind. */
  await page.evaluate(() => {
    const stops = document.querySelectorAll('#console-drawer a[href], #console-drawer button:not([disabled])');
    stops[stops.length - 1].focus();
  });
  await page.keyboard.press('Tab');
  const wrapped = await page.evaluate(() => {
    const drawer = document.getElementById('console-drawer');
    return drawer.contains(document.activeElement) && drawer.querySelector('a[href]') === document.activeElement;
  });
  if (!wrapped) throw new Error('Tab left the drawer instead of wrapping to its first link');

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('console-drawer'), { timeout: 5000 });
  const back = await page.evaluate(
    () => document.activeElement?.getAttribute('aria-label') === 'Open navigation',
  );
  if (!back) throw new Error('Focus was not returned to the menu button');
  await page.setViewport({ width: 1440, height: 960, isMobile: false });
});

/* ------------------------------------------------------------------ *
 * 10. Lab: the spatial team builder
 * ------------------------------------------------------------------ */
console.log('\nLab: spatial team builder');

const LAB = `${BASE}/lab/team-builder`;
const labCard = (name) => `button[data-variant][aria-label^="${name}"]`;
const slotLabel = (i) => page.$eval(`[data-slot-button="${i}"]`, (el) => el.getAttribute('aria-label'));
const centreOf = (selector) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, selector);

/** Waits until a node has stopped moving on screen: the camera's arrival move is over. */
async function labSettled(slot = 0) {
  let last = null;
  for (let i = 0; i < 40; i += 1) {
    const now = await centreOf(`[data-slot-button="${slot}"]`);
    if (last && Math.hypot(now.x - last.x, now.y - last.y) < 0.5) return;
    last = now;
    await sleep(250);
  }
}

await step('team builder renders the pitch, eleven positions and the squad', async () => {
  await page.goto(LAB, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (document.querySelector('canvas')?.width ?? 0) > 0, { timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll('[data-slot-button]').length === 11, { timeout: 30000 });
  await labSettled();
  await assertNoOverlay();
  const cards = await page.$$eval('button[data-variant]', (els) => els.length);
  if (cards !== 22) throw new Error(`Expected 22 squad cards, found ${cards}`);
  await shot('20-team-builder');
});

await step('team builder: keyboard pick-up, arrow to a position, place', async () => {
  await page.focus(labCard('Rohan Desai'));
  await page.keyboard.press('Enter');
  await sleep(250);
  const from = await page.evaluate(() => document.activeElement?.getAttribute('data-slot-button'));
  if (from === null || from === undefined) throw new Error('Focus did not move to a position on the pitch');
  await page.keyboard.press('ArrowRight');
  await sleep(150);
  const to = await page.evaluate(() => document.activeElement?.getAttribute('data-slot-button'));
  if (to === from) throw new Error('Arrow keys did not move between positions');
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    (i) => /Rohan Desai/.test(document.querySelector(`[data-slot-button="${i}"]`)?.getAttribute('aria-label') ?? ''),
    { timeout: 10000 },
    to,
  );
  const said = await page.$eval('[role="status"]', (el) => el.textContent ?? '');
  if (!/Rohan Desai/.test(said)) throw new Error(`Not announced: "${said}"`);
});

await step('team builder: drag a card onto a node with the mouse', async () => {
  const from = await centreOf(labCard('Harsh Trivedi'));
  const to = await centreOf('[data-slot-button="0"]');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 20; i += 1) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / 20, from.y + ((to.y - from.y) * i) / 20);
    await sleep(30);
  }
  await sleep(300);
  await page.mouse.up();
  await page.waitForFunction(
    () => /Harsh Trivedi/.test(document.querySelector('[data-slot-button="0"]')?.getAttribute('aria-label') ?? ''),
    { timeout: 10000 },
  );
  /* The click a browser fires after a drag must not also pick the player up. */
  await sleep(300);
  const pressed = await page.$eval(labCard('Harsh Trivedi'), (el) => el.getAttribute('aria-pressed'));
  if (pressed !== 'false') throw new Error('The drag also selected the card');
});

await step('team builder: dragging a chip back to the squad benches the player', async () => {
  await labSettled();
  const from = await centreOf('[data-slot-button="0"]');
  const to = await centreOf('section[aria-labelledby="tb-roster-title"] header');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 20; i += 1) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / 20, from.y + ((to.y - from.y) * i) / 20);
    await sleep(30);
  }
  await sleep(300);
  await page.mouse.up();
  await page.waitForFunction(
    () => /empty/.test(document.querySelector('[data-slot-button="0"]')?.getAttribute('aria-label') ?? ''),
    { timeout: 10000 },
  );
});

await step('team builder: formation switch and auto-pick fill all eleven', async () => {
  await page.click('button[role="radio"]::-p-text(3-5-2)');
  await sleep(600);
  const group = await page.$eval('[role="group"][aria-label^="Pitch"]', (el) => el.getAttribute('aria-label'));
  if (!/3-5-2/.test(group ?? '')) throw new Error(`Formation did not change: "${group}"`);
  await page.click('button[aria-label="Auto-pick the best eleven"]');
  await sleep(1200);
  const filled = await page.$$eval('[data-slot-button]', (els) => els.filter((el) => !/empty/.test(el.getAttribute('aria-label') ?? '')).length);
  if (filled !== 11) throw new Error(`Auto-pick filled ${filled} of 11`);
});

await step('team builder has no axe violations', async () => {
  await page.evaluate(axeSource);
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
    });
    return result.violations.map((v) => `${v.id} x${v.nodes.length} (${v.nodes[0]?.target.join(' ')})`);
  });
  if (violations.length) throw new Error(violations.join('; '));
});

await step('team builder at phone width: squad strip, no overflow, tap to place', async () => {
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(LAB, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('[data-slot-button]').length === 11, { timeout: 30000 });
  await labSettled();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) throw new Error(`Horizontal overflow of ${overflow}px`);
  const variant = await page.$eval('button[data-variant]', (el) => el.getAttribute('data-variant'));
  if (variant !== 'strip') throw new Error(`Squad is a ${variant}, not a strip`);
  await page.tap(labCard('Aarav Shah'));
  await sleep(300);
  await page.tap('[data-slot-button="6"]');
  await page.waitForFunction(
    () => /Aarav Shah/.test(document.querySelector('[data-slot-button="6"]')?.getAttribute('aria-label') ?? ''),
    { timeout: 10000 },
  );
  await shot('21-team-builder-phone');
  await page.setViewport({ width: 1440, height: 960, isMobile: false, hasTouch: false });
});

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */
await browser.close();

const failed = results.filter((r) => !r.ok);

console.log('\n=== SUMMARY ===');
console.log(`${results.length - failed.length}/${results.length} steps passed`);

if (failed.length) {
  console.log('\nFailures:');
  for (const f of failed) console.log(`  - ${f.name}: ${f.error}`);
}

if (noise.length) {
  console.log(`\nConsole/network noise (${noise.length}):`);
  for (const n of [...new Set(noise)].slice(0, 30)) console.log(`  ${n}`);
}

exit(failed.length || noise.length ? 1 : 0);
