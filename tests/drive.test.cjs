// Takeout exports on Google Drive, with Google sign-in and the Drive API replaced by mocks.
const fs = require('fs');
const path = require('path');
const { FX, PAGE, routeAll, launch, serve, checker, same, sorted, shot, EXPECT } = require('./common.cjs');

// Stand-in for Google Identity Services: every sign-in hands out the next token.
const GIS = `window.__tok = 0; window.google = { accounts: { oauth2: {
  initTokenClient(cfg) { window.__cfg = cfg; return { requestAccessToken() { window.__tok++; setTimeout(() => cfg.callback({ access_token: 'tok' + window.__tok, expires_in: 3599, scope: cfg.scope }), 30); } }; },
  hasGrantedAllScopes(r, sc) { return String(r.scope).split(' ').includes(sc); },
  revoke(t, cb) { cb && cb(); } } } };`;
const ZIPS = {
  z1: fs.readFileSync(path.join(FX, 'takeout-20250101T000000Z-001.zip')),
  z2: fs.readFileSync(path.join(FX, 'takeout-20250101T000000Z-002.zip')),
};
const stats = { ranges: 0, bytes: 0, refused: 0 };
let refuse = null;

async function drive(route, url) {
  const req = route.request();
  if (url === 'https://accounts.google.com/gsi/client') { await route.fulfill({ body: GIS, contentType: 'text/javascript' }); return true; }
  if (!url.startsWith('https://www.googleapis.com/drive/v3/files')) return false;
  const cors = { 'access-control-allow-origin': '*' };
  const auth = req.headers().authorization || '';
  if (!/^Bearer tok\d+$/.test(auth) || auth === 'Bearer ' + refuse) { stats.refused++; await route.fulfill({ status: 401, headers: cors, body: '{}' }); return true; }
  const u = new URL(url);
  if (u.pathname === '/drive/v3/files') {
    const files = [
      { id: 'z1', name: 'takeout-20250101T000000Z-001.zip', size: String(ZIPS.z1.length), createdTime: '2025-01-01T01:00:00Z' },
      { id: 'z2', name: 'takeout-20250101T000000Z-002.zip', size: String(ZIPS.z2.length), createdTime: '2025-01-01T01:00:00Z' },
      { id: 'old', name: 'takeout-20240301T101500Z-001.zip', size: '5300000000', createdTime: '2024-03-01T12:00:00Z' },
      { id: 'txt', name: 'takeout notes.txt', size: '10', createdTime: '2024-03-01T12:00:00Z' },
    ];
    await route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ files }) });
    return true;
  }
  const buf = ZIPS[decodeURIComponent(u.pathname.split('/').pop())];
  const m = /bytes=(\d+)-(\d+)/.exec(req.headers().range || '');
  if (!buf || !m) { await route.fulfill({ status: 400, headers: cors, body: '{}' }); return true; }
  const a = +m[1], b = Math.min(+m[2], buf.length - 1);
  stats.ranges++;
  stats.bytes += b - a + 1;
  await route.fulfill({ status: 206, headers: { ...cors, 'content-range': `bytes ${a}-${b}/${buf.length}` }, body: buf.subarray(a, b + 1) });
  return true;
}

(async () => {
  const t = checker(`Google Drive (${PAGE})`);
  const { server, origin } = await serve();
  const browser = await launch();
  const context = await browser.newContext({ viewport: { width: 1360, height: 860 } });
  await routeAll(context, drive, origin);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${origin}/`);
  await page.waitForTimeout(1200);
  t.check('index.html forwards to the current version', page.url().endsWith('/' + PAGE), page.url());

  await page.click('#w-close');
  await page.click('#btn-add');
  await page.click('#menu [data-pick="drive"]');
  await page.waitForSelector('#dv-signin:not([disabled])');
  t.check('built-in client ID: the dialog goes straight to sign-in', true);
  await page.click('#dv-edit');
  t.check('changing the client ID shows this page\'s origin', await page.evaluate(o => document.querySelector('#dv-body').textContent.includes(o), origin));
  await page.fill('#dv-id', 'not a client id');
  await page.click('#dv-save');
  t.check('a malformed client ID is refused', /doesn't look like a client ID/.test(await page.textContent('#dv-body .err')));
  t.check('the form keeps what was typed', (await page.inputValue('#dv-id')) === 'not a client id');
  await page.fill('#dv-id', '123456789012-abcdef123.apps.googleusercontent.com');
  await page.click('#dv-save');
  await page.waitForSelector('#dv-signin:not([disabled])');
  await page.click('#dv-signin');
  await page.waitForSelector('.dv-row');
  const rows = await page.$$eval('.dv-row', rs => rs.map(r => r.innerText.replace(/\s+/g, ' ')));
  t.check('exports are grouped by date, newest first', rows.length === 2 && /1 January 2025 2 files/.test(rows[0]) && /1 March 2024 1 file · 5\.3 GB/.test(rows[1]), rows);
  t.check('sign-in used the new client ID', await page.evaluate(() => window.__cfg.client_id) === '123456789012-abcdef123.apps.googleusercontent.com');
  await shot(page, 'drive-1-exports');

  await page.click('.dv-row button[data-export="0"]');
  await page.waitForFunction(() => !S.busy && S.items.length > 0, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => ({
    placed: S.placed.map(p => p.name), unplaced: S.unplaced.map(p => p.name), devNote: !document.querySelector('#dev-note').hidden,
    dscT: (S.placed.find(p => p.name === 'DSC_0100.jpg') || {}).t,
  }));
  t.check('Drive: the right photos land on the map', same(sorted(r.placed), EXPECT.placed), r.placed);
  t.check('Drive: the right photos have no location', same(sorted(r.unplaced), EXPECT.unplaced), r.unplaced);
  t.check('Drive: EXIF of a compressed entry, time zone included', r.dscT === Date.parse('2022-05-01T08:15:00Z'));
  t.check('Drive: device reading waits to be asked', r.devNote);
  t.check('Drive: read in pieces', stats.ranges > 5, stats);

  const rot = await page.evaluate(async () => {
    const p = S.placed.find(q => q.name === 'IMG_0006.jpg');
    const url = thumbs.get(p.id);
    if (!url) return null;
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = c.height = 192;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const px = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data.slice(0, 3));
    return { top: px(96, 8), left: px(8, 96) };
  });
  // The stored preview has a red band on its left; orientation 6 turns it to the top.
  t.check('preview from inside the photo, turned upright', rot && rot.top[0] > 150 && rot.top[1] < 90 && rot.left[0] < 150, rot);

  await page.click('#dev-read');
  await page.waitForFunction(() => !S.scan, null, { timeout: 20000 });
  t.check('Drive: device list after reading', same(await page.$$eval('#device option', os => os.map(o => o.textContent)), EXPECT.devices));

  const inflate = await page.evaluate(async () => {
    const src = new Uint8Array(400000);
    for (let i = 0; i < src.length; i++) src[i] = (i * 7919 + (i >> 5)) & 255;
    const comp = new Uint8Array(await new Response(new Blob([src]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
    const out = new Uint8Array(await (await inflateHead(comp.subarray(0, Math.min(comp.length - 1, 70000)), 65536, false)).arrayBuffer());
    return out.length >= 65536 && out.subarray(0, 65536).every((v, i) => v === src[i]);
  });
  t.check('unpacking the start of a cut-off compressed entry', inflate);

  await page.evaluate(() => { const i = S.panelList.findIndex(p => p.name === 'IMG_0003.jpg'); openViewer(S.panelList, i); });
  await page.waitForSelector('#lb-media > img', { timeout: 10000 });
  t.check('viewer names the archive on Drive', await page.evaluate(() => document.querySelector('#lb-dl').innerText.includes('takeout-20250101T000000Z-001.zip on Google Drive')));
  refuse = await page.evaluate(() => D.tok);
  await page.evaluate(() => { D.expires = Date.now() + 3600e3; });
  await page.keyboard.press('ArrowRight');
  await page.waitForSelector('#reauth:not([hidden])', { timeout: 10000 });
  t.check('an expired sign-in asks to sign in again', stats.refused >= 1);
  await page.click('#reauth-btn');
  await page.waitForSelector('#lb-media > img', { timeout: 10000 });
  t.check('after signing in again the photo loads', await page.evaluate(() => document.querySelector('#reauth').hidden && window.__tok === 2));
  await page.keyboard.press('Escape');

  t.check('no script errors', !errors.length, errors);
  await browser.close();
  server.close();
  t.finish();
})().catch(e => { console.error(e); process.exit(1); });
