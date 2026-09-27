// Files from this computer: the demo, Takeout ZIPs, an unzipped folder, and the filters.
const path = require('path');
const { ROOT, FX, PAGE, routeAll, launch, checker, same, sorted, shot, EXPECT } = require('./common.cjs');

(async () => {
  const t = checker(`local files (${PAGE})`);
  const browser = await launch();
  const context = await browser.newContext({ viewport: { width: 1360, height: 860 } });
  await routeAll(context);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(ROOT, PAGE));
  await page.waitForTimeout(1500);

  const demo = await page.evaluate(() => ({
    placed: S.placed.length, unplaced: S.unplaced.length, demo: S.demo, ver: document.querySelector('#ver').textContent,
    acts: ACT.list.length, actsDemo: ACT.demo, tabs: !document.querySelector('#tabs').hidden,
    during: document.querySelector('#chip-act').hidden ? 0 : +document.querySelector('#chip-act b').textContent,
    alta: (ACT.list.find(a => a.name === 'Alta Via 1, day 1') || { photos: [] }).photos.length,
    tracks: ACT.lines.size, timeline: !document.querySelector('#tl').hidden,
  }));
  t.check('demo loads 105 placed and 6 unplaced photos', demo.placed === 105 && demo.unplaced === 6 && demo.demo, demo);
  t.check('version label matches the file name', PAGE === `photoatlas_${demo.ver}.html`, demo.ver);
  t.check('demo has 10 activities with tracks and an Activities tab', demo.acts === 10 && demo.actsDemo && demo.tabs && demo.tracks === 10, demo);
  t.check('demo photos are matched to demo activities', demo.during >= 21 && demo.alta >= 4, demo);
  await shot(page, 'local-1-demo');

  await page.setInputFiles('#in-zip', [path.join(FX, 'takeout-20250101T000000Z-001.zip'), path.join(FX, 'takeout-20250101T000000Z-002.zip')]);
  await page.waitForFunction(() => !S.busy && S.items.length > 0, null, { timeout: 30000 });
  await page.waitForFunction(() => !S.scan, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  const z = await page.evaluate(() => {
    const one = S.placed.find(p => p.name === 'IMG_0001-edited.jpg');
    const dsc = S.placed.find(p => p.name === 'DSC_0100.jpg');
    return {
      placed: S.placed.map(p => p.name), unplaced: S.unplaced.map(p => p.name), toast: document.querySelector('#toast').textContent,
      albums: one ? [...one.albums] : null, oneLat: one && one.lat, dscT: dsc && dsc.t, dscLat: dsc && dsc.lat,
      acts: ACT.list.length, tabs: !document.querySelector('#tabs').hidden,
      devices: [...document.querySelectorAll('#device option')].map(o => o.textContent),
    };
  });
  t.check('ZIPs: the right photos land on the map', same(sorted(z.placed), EXPECT.placed), z.placed);
  t.check('ZIPs: the right photos have no location', same(sorted(z.unplaced), EXPECT.unplaced), z.unplaced);
  t.check('ZIPs: summary message', z.toast === '8 photos on the map, 2 without a location.', z.toast);
  t.check('edited copy shown once, with its album and position', same(z.albums, ['Summer Trip']) && Math.abs(z.oneLat - 38.7139) < 1e-6, z);
  t.check('GPS from EXIF inside a compressed ZIP entry', Math.abs(z.dscLat - 48.1374) < 1e-4, z.dscLat);
  t.check('EXIF time zone offset is applied', z.dscT === Date.parse('2022-05-01T08:15:00Z'), new Date(z.dscT).toISOString());
  t.check('demo activities leave with the demo photos', z.acts === 0 && !z.tabs, z);
  t.check('device list', same(z.devices, EXPECT.devices), z.devices);
  await shot(page, 'local-2-zips');

  await page.selectOption('#device', 'Google Pixel 7');
  const pixel = await page.evaluate(() => ({ names: S.filtered.map(p => p.name), map: document.querySelector('#st-map b').textContent }));
  t.check('device filter', pixel.names.length === 3 && pixel.map === '3 of 8', pixel);
  await page.selectOption('#device', '');

  await page.fill('#tl-from', '2021-08-15');
  await page.fill('#tl-to', '2021-08-16');
  const range = await page.evaluate(() => ({
    names: S.filtered.map(p => p.name), label: document.querySelector('#tl-label').textContent,
    count: document.querySelector('#tl-count').textContent, on: document.querySelector('#tl-from').classList.contains('on'),
    clear: !document.querySelector('#tl-clear').hidden,
  }));
  t.check('date range: exact days', same(sorted(range.names), ['IMG_0003(1).jpg', 'IMG_0003.jpg']) && range.count === '2 photos', range);
  t.check('date range: label and state', range.label === '15 Aug 2021 – 16 Aug 2021' && range.on && range.clear, range);
  await page.fill('#tl-to', '');
  const open = await page.evaluate(() => ({ n: S.filtered.length, to: document.querySelector('#tl-to').value }));
  t.check('date range: a start date alone runs to the last photo', open.n === 7 && open.to !== '', open);
  await page.fill('#tl-from', '2021-08-16');
  await page.fill('#tl-to', '2021-08-16');
  const day = await page.evaluate(() => ({ names: S.filtered.map(p => p.name), label: document.querySelector('#tl-label').textContent }));
  t.check('date range: a single day', same(day.names, ['IMG_0003(1).jpg']) && day.label === '16 Aug 2021', day);
  await page.click('#tl-clear');
  const box = await page.locator('#tl-cv').boundingBox();
  await page.mouse.move(box.x + box.width * 0.02, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  const brush = await page.evaluate(() => ({ from: document.querySelector('#tl-from').value, to: document.querySelector('#tl-to').value, n: S.filtered.length, label: document.querySelector('#tl-label').textContent }));
  // The drag covers the months around August 2021, which hold every 2021 photo but not the one from 2022.
  t.check('dragging on the timeline picks whole months and fills the dates', /-01$/.test(brush.from) && brush.to !== '' && brush.n === 7 && / – /.test(brush.label), brush);
  await page.click('#tl-clear');
  t.check('clearing the range shows everything again', await page.evaluate(() => S.filtered.length === 8 && !S.range));

  await page.evaluate(() => { const i = S.panelList.findIndex(p => p.name === 'IMG_0001-edited.jpg'); openViewer(S.panelList, i); });
  await page.waitForSelector('#lb-media > img', { timeout: 10000 });
  const v = await page.evaluate(() => document.querySelector('#lb-dl').innerText.replace(/\s+/g, ' '));
  t.check('viewer shows place, album, people, description and device', /38\.71390° N/.test(v) && /Summer Trip/.test(v) && /Anna/.test(v) && /Tram 28/.test(v) && /Google Pixel 7/.test(v), v);
  await page.keyboard.press('Escape');

  await page.evaluate(() => startOver());
  await page.setInputFiles('#in-folder', path.join(FX, 'extracted'));
  await page.waitForFunction(() => !S.busy && S.items.length > 0, null, { timeout: 30000 });
  const f = await page.evaluate(() => ({ placed: S.placed.map(p => p.name), unplaced: S.unplaced.map(p => p.name) }));
  t.check('unzipped folder gives the same result as the ZIPs', same(sorted(f.placed), EXPECT.placed) && same(sorted(f.unplaced), EXPECT.unplaced), f);

  await page.setViewportSize({ width: 400, height: 820 });
  await page.waitForTimeout(600);
  await shot(page, 'local-3-phone');
  t.check('no sideways scrolling at phone width', !(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)));
  t.check('no script errors', !errors.length, errors);
  await browser.close();
  t.finish();
})().catch(e => { console.error(e); process.exit(1); });
