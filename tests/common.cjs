// Shared by the browser tests: finds the page, serves it, stands in for the CDNs and map
// tiles, and counts passes and failures.
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const NM = path.join(__dirname, 'node_modules');
const FX = path.join(__dirname, 'fixture');
const SHOTS = path.join(__dirname, 'shots');
const PAGE = fs.readdirSync(ROOT).find(f => /^photoatlas_v\d+\.\d\.html$/.test(f));
if (!PAGE) throw new Error('no photoatlas_vX.Y.html next to tests/');
if (!fs.existsSync(path.join(FX, 'takeout-20250101T000000Z-001.zip'))) throw new Error('run "python3 make_fixture.py" first');

// The page loads these from cdnjs and jsDelivr; the tests hand over the same files from npm.
const LIBS = {
  'leaflet/1.9.4/leaflet.js': 'leaflet/dist/leaflet.js',
  'leaflet/1.9.4/leaflet.css': 'leaflet/dist/leaflet.css',
  'leaflet.markercluster/1.5.3/leaflet.markercluster.js': 'leaflet.markercluster/dist/leaflet.markercluster.js',
  'exifr@7.1.3/dist/full.umd.js': 'exifr/dist/full.umd.js',
  'zip.js@2.7.57/dist/zip-no-worker-inflate.min.js': '@zip.js/zip.js/dist/zip-no-worker-inflate.min.js',
  'heic2any@0.0.4/dist/heic2any.min.js': 'heic2any/dist/heic2any.min.js',
};

// Standard answers for everything that isn't the page itself; `extra` handles the rest.
function routeAll(context, extra, local) {
  return context.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith('file:') || (local && url.startsWith(local))) return route.continue();
    for (const [k, f] of Object.entries(LIBS)) if (url.endsWith(k)) return route.fulfill({ path: path.join(NM, f) });
    if (url.includes('/leaflet/1.9.4/images/')) return route.fulfill({ path: path.join(NM, 'leaflet/dist/images', url.split('/').pop()) });
    if (url.includes('cartocdn') || url.includes('arcgisonline')) return route.fulfill({ path: path.join(FX, 'tile.png') });
    if (url.includes('fonts.googleapis')) return route.fulfill({ body: '', contentType: 'text/css' });
    if (extra && (await extra(route, url))) return undefined;
    return route.abort();
  });
}

async function launch() {
  const { chromium } = require('playwright');
  const exe = process.env.PW_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  return chromium.launch({ executablePath: exe });
}

// A tiny static server for the repository, so sign-in code sees a real http origin.
function serve() {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
  const server = http.createServer((req, res) => {
    let file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(res => server.listen(0, '127.0.0.1', () => res({ server, origin: `http://127.0.0.1:${server.address().port}` })));
}

function checker(title) {
  let failed = 0;
  console.log(`\n${title}`);
  return {
    check(name, ok, detail) {
      console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${!ok && detail !== undefined ? '\n       got: ' + JSON.stringify(detail) : ''}`);
      if (!ok) failed++;
    },
    finish() {
      console.log(failed ? `  ${failed} failed` : '  all passed');
      process.exitCode = failed ? 1 : 0;
    },
  };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sorted = a => a.slice().sort();
const shot = (page, name) => { fs.mkdirSync(SHOTS, { recursive: true }); return page.screenshot({ path: path.join(SHOTS, name + '.png') }); };

// What the fixture export must turn into.
const EXPECT = {
  placed: sorted(['DSC_0100.jpg', 'IMG_0001-edited.jpg', 'IMG_0003(1).jpg', 'IMG_0003.jpg', 'IMG_0005.jpg', 'IMG_0006.jpg',
    'PXL_20210814_123456789_a_very_long_name_for_testing.jpg', 'VID_0007.mp4']),
  unplaced: sorted(['DSC_0101.jpg', 'IMG_0002.jpg']),
  devices: ['All devices', 'Google Pixel 7 (3)', 'Apple iPhone 13 Pro (1)', 'Nikon Z 6 (1)', 'Samsung SM-G991B (1)', 'Sony ILCE-7M3 (1)', 'Unknown device (3)'],
};

module.exports = { ROOT, FX, PAGE, routeAll, launch, serve, checker, same, sorted, shot, EXPECT };
