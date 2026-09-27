// Strava: sign-in through the pop-up, activities with tracks, and matching photos by time.
// Strava itself is replaced by a mock that plays its OAuth and API parts.
const path = require('path');
const { FX, PAGE, routeAll, launch, serve, checker, same, sorted, shot } = require('./common.cjs');

function encodePolyline(pts) {
  const enc = v => {
    v = v < 0 ? ~(v << 1) : v << 1;
    let s = '';
    while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; }
    return s + String.fromCharCode(v + 63);
  };
  let out = '', pa = 0, pb = 0;
  for (const [la, lo] of pts) {
    const a = Math.round(la * 1e5), b = Math.round(lo * 1e5);
    out += enc(a - pa) + enc(b - pb);
    pa = a;
    pb = b;
  }
  return out;
}
const track = (lat, lng) => Array.from({ length: 20 }, (_, i) => [lat + i * 0.001, lng + Math.sin(i / 3) * 0.002]);
const activity = (id, name, sport, start, secs, line, dist) => ({
  id, name, sport_type: sport, type: sport, start_date: start, elapsed_time: secs, moving_time: Math.round(secs * 0.9),
  distance: dist, total_elevation_gain: 12, map: { summary_polyline: line ? encodePolyline(line) : '' },
});
// Fixture photos (UTC): IMG_0001 2021-08-14 12:26:40, IMG_0002 13:26:40, IMG_0003 2021-08-15 12:26:40,
// DSC_0100 2022-05-01 08:15 once its +02:00 offset is applied (10:15 local).
const ACTS = [
  activity(101, 'Lisbon walk', 'Walk', '2021-08-14T12:00:00Z', 3600, track(38.71, -9.14), 4200),
  activity(102, 'Porto run', 'Run', '2021-08-15T12:10:00Z', 1200, track(41.15, -8.63), 3200),
  activity(103, 'Munich ride', 'Ride', '2022-05-01T08:00:00Z', 1800, track(48.13, 11.57), 11800),
  activity(104, 'Indoor workout', 'WeightTraining', '2023-01-01T10:00:00Z', 3000, null, 0),
  activity(105, 'Seville ride', 'Ride', '2021-08-17T10:00:00Z', 600, track(37.38, -5.98), 5100),
];

const calls = { token: [], api: [], authorize: [], deauth: 0 };
let tokenFail = false;
async function strava(route, url) {
  const req = route.request();
  const cors = { 'access-control-allow-origin': '*' };
  if (url.startsWith('https://www.strava.com/oauth/authorize')) {
    const u = new URL(url);
    calls.authorize.push(Object.fromEntries(u.searchParams));
    const back = new URL(u.searchParams.get('redirect_uri'));
    back.searchParams.set('state', u.searchParams.get('state'));
    back.searchParams.set('code', 'code-' + calls.authorize.length);
    back.searchParams.set('scope', 'read,activity:read_all');
    await route.fulfill({ status: 302, headers: { location: back.toString() } });
    return true;
  }
  if (url === 'https://www.strava.com/oauth/token') {
    const params = Object.fromEntries(new URLSearchParams(req.postData() || ''));
    calls.token.push(params);
    if (tokenFail) {
      await route.fulfill({ status: 400, headers: cors, contentType: 'application/json', body: JSON.stringify({ message: 'Bad Request' }) });
      return true;
    }
    const n = calls.token.length;
    const athlete = params.grant_type === 'authorization_code' ? { firstname: 'Anna', lastname: 'Test' } : undefined;
    await route.fulfill({
      status: 200, headers: cors, contentType: 'application/json',
      body: JSON.stringify({ token_type: 'Bearer', access_token: 'sa' + n, refresh_token: 'sr' + n, expires_at: Math.floor(Date.now() / 1000) + 21600, athlete }),
    });
    return true;
  }
  if (url.startsWith('https://www.strava.com/api/v3/athlete/activities')) {
    calls.api.push(req.headers().authorization);
    const page = +new URL(url).searchParams.get('page');
    await route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(page === 1 ? ACTS : []) });
    return true;
  }
  if (url === 'https://www.strava.com/oauth/deauthorize') {
    calls.deauth++;
    await route.fulfill({ status: 200, headers: cors, body: '{}' });
    return true;
  }
  return false;
}

(async () => {
  const t = checker(`Strava (${PAGE})`);
  const { server, origin } = await serve();
  const browser = await launch();
  const context = await browser.newContext({ viewport: { width: 1360, height: 860 } });
  await routeAll(context, strava, origin);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${origin}/${PAGE}`);
  await page.waitForTimeout(1000);
  await page.click('#w-close');
  await page.setInputFiles('#in-zip', [path.join(FX, 'takeout-20250101T000000Z-001.zip'), path.join(FX, 'takeout-20250101T000000Z-002.zip')]);
  await page.waitForFunction(() => !S.busy && S.items.length > 0, null, { timeout: 30000 });

  await page.click('#btn-strava');
  await page.waitForSelector('#sv-id');
  await page.fill('#sv-id', '12345');
  await page.fill('#sv-secret', 'abc');
  await page.click('#sv-save');
  t.check('a malformed client secret is refused', /Client Secret/.test(await page.textContent('#sv-body .err')));
  t.check('the form keeps what was typed', (await page.inputValue('#sv-id')) === '12345');
  const secret = '0123456789abcdef0123456789abcdef01234567';
  await page.fill('#sv-secret', secret);
  await page.click('#sv-save');
  await page.waitForSelector('#sv-connect');
  const popupOpened = context.waitForEvent('page');
  await page.click('#sv-connect');
  const popup = await popupOpened;
  await page.waitForFunction(() => ACT.list.length === 5 && !ACT.demo, null, { timeout: 20000 });
  await page.waitForTimeout(600);
  const auth = calls.authorize[0];
  t.check('Strava is asked for this app, all activities and a return to this page',
    auth.client_id === '12345' && /activity:read_all/.test(auth.scope) && auth.redirect_uri === `${origin}/${PAGE}` && auth.response_type === 'code', auth);
  t.check('the code is exchanged with the app\'s secret', calls.token[0].grant_type === 'authorization_code' && calls.token[0].code === 'code-1' && calls.token[0].client_secret === secret, calls.token[0]);
  t.check('the sign-in window closes itself', popup.isClosed(), popup.url());
  const st = await page.evaluate(() => ({
    items: S.items.length, placed: S.placed.length, panel: S.panel, tabs: !document.querySelector('#tabs').hidden,
    toast: document.querySelector('#toast').textContent, count: document.querySelector('#strava-n').textContent,
    photos: Object.fromEntries(ACT.list.map(a => [a.id, a.photos.map(p => p.name)])), lines: ACT.lines.size,
    first: ACT.byId.get(101).line[0], during: document.querySelector('#chip-act b').textContent,
    marker: S.placed.find(p => p.name === 'IMG_0003.jpg').marker.options.icon.options.className,
    stored: localStorage.getItem('photo-atlas:strava-tokens'),
  }));
  t.check('photos added before connecting are still there', st.items > 0 && st.placed === 8, st);
  t.check('photos are matched to the activities they were taken during', same(st.photos, {
    101: ['IMG_0001-edited.jpg'], 102: ['IMG_0003.jpg'], 103: ['DSC_0100.jpg'], 104: [], 105: [],
  }), st.photos);
  t.check('tracks are drawn for activities with GPS', st.lines === 4, st.lines);
  t.check('Strava tracks decode to the right coordinates', Math.abs(st.first[0] - 38.71) < 1e-5 && Math.abs(st.first[1] + 9.14) < 1e-5, st.first);
  t.check('photos taken during activities are marked', st.during === '3' && /\bact s-run\b/.test(st.marker), st);
  t.check('the Activities tab opens after connecting', st.panel === 'acts' && st.tabs, st);
  t.check('summary and header count', st.toast === '5 Strava activities on the map, 3 with photos.' && st.count === '5', st);
  t.check('the sign-in is kept for the next visit', /"access":"sa1"/.test(st.stored || ''), st.stored);
  await shot(page, 'strava-1-activities');

  const list = await page.evaluate(() => ({ n: document.querySelectorAll('#acts .act-item').length, text: document.querySelector('#acts-count').textContent }));
  t.check('activities in view (the indoor one has no place on the map)', list.n === 4 && list.text === '4 activities', list);
  await page.check('#acts-photos');
  t.check('"Only activities with photos"', await page.evaluate(() => document.querySelectorAll('#acts .act-item').length) === 3);
  await page.locator('#acts .act-item', { hasText: 'Porto run' }).click();
  await page.waitForTimeout(500);
  const one = await page.evaluate(() => ({
    panel: S.panel, name: document.querySelector('#act-name').textContent, count: document.querySelector('#act-count').textContent,
    link: document.querySelector('#act-link').href, cells: document.querySelectorAll('#grid .cell').length,
    shown: S.filtered.map(p => p.name), timeline: document.querySelector('#tl').hidden, zoom: map.getZoom(),
    meta: document.querySelector('#act-meta').textContent,
  }));
  t.check('opening an activity shows its photos and zooms to its track',
    one.panel === 'act' && one.name === 'Porto run' && one.count === '1 photo during this activity' && one.cells === 1 && same(one.shown, ['IMG_0003.jpg']) && one.timeline && one.zoom >= 12, one);
  t.check('activity details and Strava link', /Run · 3\.2 km/.test(one.meta) && one.link === 'https://www.strava.com/activities/102', one);
  await shot(page, 'strava-2-activity');

  await page.click('#grid .cell');
  await page.waitForSelector('#lb-media > img', { timeout: 10000 });
  const v1 = await page.evaluate(() => ({ dl: document.querySelector('#lb-dl').innerText.replace(/\s+/g, ' '), btn: document.querySelector('#lb-act').hidden }));
  t.check('viewer names the activity', /Porto run \(Run, 3\.2 km\)/.test(v1.dl) && v1.btn, v1);
  await page.keyboard.press('Escape');
  await page.click('#act-back');
  t.check('back to the activity list', await page.evaluate(() => S.panel === 'acts' && !ACT.selected));
  await page.click('#tab-photos');
  await page.evaluate(() => openViewer([S.placed.find(p => p.name === 'IMG_0001-edited.jpg')], 0));
  await page.waitForSelector('#lb-act:not([hidden])');
  await page.click('#lb-act');
  t.check('from a photo to the activity it was taken during', await page.evaluate(() => S.panel === 'act' && ACT.selected.id === 101 && lb.hidden));
  await page.click('#tab-photos');

  await page.click('#chip-act');
  t.check('"During activities" shows only those photos', same(sorted(await page.evaluate(() => S.filtered.map(p => p.name))), ['DSC_0100.jpg', 'IMG_0001-edited.jpg', 'IMG_0003.jpg']));
  await page.click('#chip-act');
  await page.fill('#tl-from', '2021-08-14');
  await page.fill('#tl-to', '2021-08-15');
  const ranged = await page.evaluate(() => ({ ids: S.actsFiltered.map(a => a.id), tab: document.querySelector('#tab-acts-n').textContent, lines: ACT.lines.size }));
  t.check('the date range narrows the activities too', same(ranged.ids, [101, 102]) && ranged.tab === '2' && ranged.lines === 2, ranged);
  await page.click('#tl-clear');

  await page.evaluate(() => { ST.tokens.expires = 0; store.set('strava-tokens', JSON.stringify(ST.tokens)); });
  await page.click('#btn-strava');
  await page.click('#sv-reload');
  await page.waitForFunction(() => ST.state === 'idle', null, { timeout: 10000 });
  const last = calls.token[calls.token.length - 1];
  t.check('an expired Strava token is refreshed', last.grant_type === 'refresh_token' && last.refresh_token === 'sr1' && calls.api[calls.api.length - 1] === 'Bearer sa2', { last, api: calls.api });
  await page.click('#sv-close');

  await page.reload();
  await page.waitForFunction(() => ACT.list.length === 5 && !ACT.demo, null, { timeout: 20000 });
  t.check('activities load again by themselves on the next visit', calls.api[calls.api.length - 1] === 'Bearer sa2');

  await page.click('#w-close');
  await page.click('#btn-strava');
  await page.click('#sv-disconnect');
  const off = await page.evaluate(() => ({ n: ACT.list.length, tabs: document.querySelector('#tabs').hidden, stored: localStorage.getItem('photo-atlas:strava-tokens') }));
  t.check('disconnecting removes the activities and the saved sign-in', off.n === 0 && off.tabs && !off.stored && calls.deauth === 1, off);

  tokenFail = true;
  await page.waitForSelector('#sv-connect');
  const again = context.waitForEvent('page');
  await page.click('#sv-connect');
  await again;
  await page.waitForSelector('#sv-body .err', { timeout: 10000 });
  t.check('a refused sign-in is explained', /Strava refused the sign-in \(400: Bad Request\)/.test(await page.textContent('#sv-body .err')));

  t.check('no script errors', !errors.length, errors);
  await browser.close();
  server.close();
  t.finish();
})().catch(e => { console.error(e); process.exit(1); });
