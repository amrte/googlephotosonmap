// Strava's free data export: read from a ZIP or a folder, straight from the file on disk.
const path = require('path');
const { ROOT, FX, PAGE, routeAll, launch, checker, same, sorted, shot } = require('./common.cjs');

const MATCHES = { 201: ['IMG_0001-edited.jpg'], 202: ['IMG_0003.jpg'], 203: ['DSC_0100.jpg'], 204: [], 205: ['IMG_0002.jpg'] };

async function state(page) {
  return page.evaluate(() => {
    const two = S.placed.find(p => p.name === 'IMG_0002.jpg');
    const acts = Object.fromEntries(ACT.list.map(a => [a.id, a]));
    return {
      n: ACT.list.length, src: [...new Set(ACT.list.map(a => a.src))], busy: S.busy,
      photos: Object.fromEntries(ACT.list.map(a => [a.id, a.photos.map(p => p.name)])),
      two: two ? [two.lat, two.lng, two.fromTrack] : null, unplaced: S.unplaced.map(p => p.name).sort(),
      names: ACT.list.map(a => a.name), items: S.items.map(i => i.path),
      late: acts[205] && { elapsed: acts[205].elapsed, timed: acts[205].timed.length, sport: acts[205].sport },
      gym: acts[204] && { start: acts[204].start, line: acts[204].line.length, elapsed: acts[204].elapsed },
      porto: acts[202] && { dist: acts[202].dist, url: acts[202].url, sport: acts[202].sport },
      ride: acts[203] && { start: acts[203].start, end: acts[203].end, line: acts[203].line.length },
      toast: document.querySelector('#toast').textContent, panel: S.panel,
      during: document.querySelector('#chip-act').hidden ? null : document.querySelector('#chip-act b').textContent,
    };
  });
}

(async () => {
  const t = checker(`Strava export (${PAGE})`);
  const browser = await launch();
  const context = await browser.newContext({ viewport: { width: 1360, height: 860 } });
  await routeAll(context);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.join(ROOT, PAGE));
  await page.waitForTimeout(1000);
  await page.click('#w-close');
  await page.setInputFiles('#in-zip', [path.join(FX, 'takeout-20250101T000000Z-001.zip'), path.join(FX, 'takeout-20250101T000000Z-002.zip')]);
  await page.waitForFunction(() => !S.busy && S.items.length > 0, null, { timeout: 30000 });
  const photoItems = await page.evaluate(() => S.items.length);

  await page.click('#btn-strava');
  t.check('the export route works from a file on disk', /Request Your Archive/.test(await page.textContent('#sv-body')));
  await page.click('#sv-close');

  // The export ZIP goes in through the same "Takeout ZIP files" picker and is recognised.
  await page.setInputFiles('#in-zip', path.join(FX, 'strava-export.zip'));
  await page.waitForFunction(() => ACT.list.length === 5 && !ACT.demo && !S.busy, null, { timeout: 30000 });
  await page.waitForTimeout(400);
  let st = await state(page);
  t.check('all five activities are read, from FIT, GPX, gzipped TCX and the CSV alone', st.n === 5 && same(st.src, ['export']), st);
  t.check('names with commas and quotes survive the CSV', st.names.includes('Porto run, with a comma'), st.names);
  t.check('photos are matched to the activities they were taken during', same(st.photos, MATCHES), st.photos);
  t.check('a photo without GPS is placed on the track where the walk was at that moment',
    st.two && Math.abs(st.two[0] - 38.73) < 2e-4 && Math.abs(st.two[1] + 9.14) < 2e-4 && st.two[2], st.two);
  t.check('only the photo that has no time stays without a location', same(st.unplaced, ['DSC_0101.jpg']), st.unplaced);
  t.check('FIT compressed timestamps: the walk lasts exactly 30 minutes', st.late && st.late.elapsed === 1800 && st.late.timed === 42 && st.late.sport === 'Walk', st.late);
  t.check('an activity without a file gets its start from the CSV', st.gym && st.gym.start === Date.parse('2023-01-01T10:00:00Z') && st.gym.line === 0 && st.gym.elapsed === 3000, st.gym);
  // The Porto track runs 0.012° north and 0.012° east at 41.15° N: 1.33 km by 1.00 km, 1.67 km straight.
  t.check('distance comes from the track, the Strava link from the ID', st.porto && Math.abs(st.porto.dist - 1670) < 10 && st.porto.url === 'https://www.strava.com/activities/202', st.porto);
  t.check('gzipped TCX track with its times', st.ride && st.ride.start === Date.parse('2022-05-01T08:00:00Z') && st.ride.end === Date.parse('2022-05-01T08:30:00Z') && st.ride.line === 31, st.ride);
  t.check('the export is not mistaken for photos', (await page.evaluate(() => S.items.length)) === photoItems && !st.items.some(p => /media\//.test(p)), st.items.length);
  t.check('summary message', st.toast === '5 Strava activities on the map, 4 with photos. 1 photo without GPS got its place from the track.', st.toast);
  t.check('the Activities tab opens and "During activities" counts 4', st.panel === 'acts' && st.during === '4', st);
  await shot(page, 'export-1-activities');

  await page.evaluate(() => openViewer([S.placed.find(p => p.name === 'IMG_0002.jpg')], 0));
  await page.waitForSelector('#lb-media > img', { timeout: 10000 });
  const place = await page.evaluate(() => document.querySelector('#lb-dl').innerText);
  t.check('the viewer says where the position came from', /from the Strava track at that moment/.test(place) && /Afternoon walk/.test(place), place);
  await page.keyboard.press('Escape');

  await page.click('#btn-strava');
  t.check('the dialog sums up the import', /5 activities from your Strava export are on the map, 4 of them with photos\. 1 photo without GPS got its place/.test(await page.textContent('#sv-body')));
  await page.click('#sv-remove');
  st = await state(page);
  t.check('removing the activities puts the placed photo back', st.n === 0 && same(st.unplaced, ['DSC_0101.jpg', 'IMG_0002.jpg']), st);
  await page.click('#sv-close');

  // Unzipped: the folder with activities.csv, picked like any other folder.
  await page.setInputFiles('#in-folder', path.join(FX, 'strava-extracted'));
  await page.waitForFunction(() => ACT.list.length === 5 && !S.busy, null, { timeout: 30000 });
  st = await state(page);
  t.check('the unzipped export folder gives the same result', same(st.photos, MATCHES) && st.two && st.two[2], st.photos);
  t.check('photos from the export\'s media folder stay out', !st.items.some(p => /media\//.test(p)) && (await page.evaluate(() => S.items.length)) === photoItems);

  await page.evaluate(() => startOver());
  await page.setInputFiles('#in-zip', path.join(FX, 'strava-export.zip'));
  await page.waitForFunction(() => ACT.list.length === 5 && !S.busy, null, { timeout: 30000 });
  await page.setInputFiles('#in-zip', [path.join(FX, 'takeout-20250101T000000Z-001.zip'), path.join(FX, 'takeout-20250101T000000Z-002.zip')]);
  await page.waitForFunction(() => !S.busy && S.items.length > 0, null, { timeout: 30000 });
  st = await state(page);
  t.check('photos added after the export are matched and placed too', same(st.photos, MATCHES) && st.two && st.two[2], st.photos);

  t.check('no script errors', !errors.length, errors);
  await browser.close();
  t.finish();
})().catch(e => { console.error(e); process.exit(1); });
