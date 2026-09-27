"""Builds a small fake Google Takeout export in tests/fixture/ for the browser tests.

It covers the awkward cases the page has to handle: metadata in another ZIP than its photo,
old, new and truncated sidecar names, (1) duplicates, edited copies, album copies, a Live
Photo movie, the trash folder, GPS only in EXIF, EXIF time zone offsets and an embedded,
rotated preview. Needs Pillow and piexif (pip install pillow piexif).
"""
import io
import json
import os
import zipfile

import piexif
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixture')
os.makedirs(OUT, exist_ok=True)
os.chdir(OUT)

def jpg(color, label, gps=None, date=None, cam=None, offset=None):
    im = Image.new('RGB', (800, 600), color)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 420, 800, 600], fill=tuple(max(0, c - 60) for c in color))
    d.ellipse([560, 80, 680, 200], fill=(255, 240, 200))
    d.text((20, 20), label, fill=(255, 255, 255))
    ex = im.getexif()
    if cam:
        ex[0x010F] = cam[0]; ex[0x0110] = cam[1]
    if date:
        ex.get_ifd(0x8769)[0x9003] = date
    if offset:
        ex.get_ifd(0x8769)[0x9011] = offset
    if gps:
        lat, lng = gps
        def dms(v):
            v = abs(v); dg = int(v); m = int((v - dg) * 60); s = round(((v - dg) * 60 - m) * 60, 4)
            return (float(dg), float(m), float(s))
        g = ex.get_ifd(0x8825)
        g[1] = 'N' if lat >= 0 else 'S'; g[2] = dms(lat); g[3] = 'E' if lng >= 0 else 'W'; g[4] = dms(lng)
        ex[0x010F] = 'SONY'; ex[0x0110] = 'ILCE-7M3'
    buf = io.BytesIO(); im.save(buf, 'JPEG', exif=ex.tobytes(), quality=80); return buf.getvalue()

def side(title, lat, lng, ts, url, desc=''):
    g = {"latitude": lat, "longitude": lng, "altitude": 0.0, "latitudeSpan": 0.0, "longitudeSpan": 0.0}
    return json.dumps({"title": title, "description": desc, "imageViews": "3",
        "creationTime": {"timestamp": str(ts + 60), "formatted": "x"},
        "photoTakenTime": {"timestamp": str(ts), "formatted": "x"},
        "geoData": g, "geoDataExif": g, "url": url,
        "people": [{"name": "Anna"}] if desc else [],
        "googlePhotosOrigin": {"mobileUpload": {"deviceType": "ANDROID_PHONE"}}}).encode()

P = 'Takeout/Google Photos/'
Y = P + 'Photos from 2021/'
T = 1628944000  # 2021-08-14
z1, z2 = {}, {}
z1[Y + 'IMG_0001.jpg'] = jpg((200, 110, 60), 'IMG_0001 original', cam=('Google', 'Pixel 7'))
z1[Y + 'IMG_0001-edited.jpg'] = jpg((230, 140, 70), 'IMG_0001 edited', cam=('Google', 'Pixel 7'))
z2[Y + 'IMG_0001.jpg.supplemental-metadata.json'] = side('IMG_0001.jpg', 38.7139, -9.1394, T, 'https://photos.google.com/photo/u1', 'Tram 28')
z1[P + 'Summer Trip/IMG_0001.jpg'] = z1[Y + 'IMG_0001.jpg']
z1[P + 'Summer Trip/IMG_0001.jpg.supplemental-metadata.json'] = side('IMG_0001.jpg', 38.7139, -9.1394, T, 'https://photos.google.com/photo/u1', 'Tram 28')
z1[P + 'Summer Trip/metadata.json'] = json.dumps({"title": "Summer Trip", "description": "", "access": "protected", "date": {"timestamp": "1628944000", "formatted": "x"}}).encode()
z1[Y + 'IMG_0002.jpg'] = jpg((90, 90, 90), 'IMG_0002 no location')
z1[Y + 'IMG_0002.jpg.json'] = side('IMG_0002.jpg', 0.0, 0.0, T + 3600, 'https://photos.google.com/photo/u2')
z1[Y + 'IMG_0003.jpg'] = jpg((60, 120, 200), 'IMG_0003 Porto', cam=('Apple', 'iPhone 13 Pro'))
z1[Y + 'IMG_0003.jpg.supplemental-metadata.json'] = side('IMG_0003.jpg', 41.1579, -8.6291, T + 86400, 'https://photos.google.com/photo/u3')
z1[Y + 'IMG_0003(1).jpg'] = jpg((60, 180, 120), 'IMG_0003(1) Madrid', cam=('samsung', 'SM-G991B'))
z1[Y + 'IMG_0003.jpg.supplemental-metadata(1).json'] = side('IMG_0003.jpg', 40.4168, -3.7038, T + 2 * 86400, 'https://photos.google.com/photo/u3b')
long = 'PXL_20210814_123456789_a_very_long_name_for_testing.jpg'
z1[Y + long] = jpg((180, 60, 140), 'long name Seville', cam=('Google', 'Pixel 7'))
z1[Y + 'PXL_20210814_123456789_a_very_long_name_for_te.json'] = side(long, 37.3891, -5.9845, T + 3 * 86400, 'https://photos.google.com/photo/u4')
z1[Y + 'IMG_0005.jpg'] = jpg((240, 200, 60), 'IMG_0005 Faro live', cam=('NIKON CORPORATION', 'NIKON Z 6'))
z1[Y + 'IMG_0005.jpg.supplemental-metadata.json'] = side('IMG_0005.jpg', 37.0194, -7.9304, T + 4 * 86400, 'https://photos.google.com/photo/u5')
z1[Y + 'IMG_0005.MP4'] = b'\x00\x00\x00\x18ftypmp42' + b'\x00' * 200
def with_thumb(data):
    t = Image.new('RGB', (160, 120), (120, 200, 220)); dd = ImageDraw.Draw(t); dd.rectangle([0, 0, 40, 120], fill=(200, 40, 40))
    tb = io.BytesIO(); t.save(tb, 'JPEG', quality=80)
    ex = {'0th': {piexif.ImageIFD.Orientation: 6, piexif.ImageIFD.Make: b'Google', piexif.ImageIFD.Model: b'Pixel 7'}, 'Exif': {}, 'GPS': {}, '1st': {piexif.ImageIFD.Compression: 6}, 'thumbnail': tb.getvalue()}
    out = io.BytesIO(); piexif.insert(piexif.dump(ex), data, out); return out.getvalue()
z1[Y + 'IMG_0006.jpg'] = with_thumb(jpg((120, 200, 220), 'IMG_0006 Coimbra'))
z1[Y + 'IMG_0006.jpg.supplemental-me.json'] = side('IMG_0006.jpg', 40.2033, -8.4103, T + 5 * 86400, 'https://photos.google.com/photo/u6')
z1[Y + 'VID_0007.mp4'] = b'\x00\x00\x00\x18ftypmp42' + b'\x00' * 200
z1[Y + 'VID_0007.mp4.supplemental-metadata.json'] = side('VID_0007.mp4', 41.5454, -8.4265, T + 6 * 86400, 'https://photos.google.com/photo/u7')
z1[P + 'Trash/IMG_9999.jpg'] = jpg((0, 0, 0), 'trash')
z1[P + 'Trash/IMG_9999.jpg.supplemental-metadata.json'] = side('IMG_9999.jpg', 10.0, 10.0, T, 'https://photos.google.com/photo/u9')
z1['Takeout/archive_browser.html'] = b'<html></html>'
Y2 = P + 'Photos from 2022/'
z2[Y2 + 'DSC_0100.jpg'] = jpg((70, 160, 90), 'DSC_0100 Munich exif', gps=(48.1374, 11.5755), date='2022:05:01 10:15:00', offset='+02:00')
z2[Y2 + 'DSC_0101.jpg'] = jpg((150, 150, 170), 'DSC_0101 nothing')

def write(name, files, deflate=()):
    with zipfile.ZipFile(name, 'w') as z:
        for k, v in files.items():
            z.writestr(zipfile.ZipInfo(k, (2022, 1, 1, 0, 0, 0)), v, compress_type=zipfile.ZIP_DEFLATED if (k.endswith('.json') or k in deflate) else zipfile.ZIP_STORED)
write('takeout-20250101T000000Z-001.zip', z1)
write('takeout-20250101T000000Z-002.zip', z2, deflate={Y2 + 'DSC_0100.jpg'})
for files, root in ((z1, 'extracted/takeout-001'), (z2, 'extracted/takeout-002')):
    for k, v in files.items():
        p = os.path.join(root, k); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, 'wb').write(v)
im = Image.new('RGB', (256, 256), (222, 226, 233)); d = ImageDraw.Draw(im); d.rectangle([0, 0, 255, 255], outline=(205, 210, 219)); im.save('tile.png')
print('ok')


# ---------------------------------------------------------------------------
# A Strava export: activities.csv plus FIT, GPX and gzipped TCX tracks, like
# Strava's "Request Your Archive". Times are UTC.
# ---------------------------------------------------------------------------
import calendar
import csv
import gzip
import struct
import time as _time

FIT_EPOCH = 631065600


def unix(s):
    return calendar.timegm(_time.strptime(s, '%Y-%m-%dT%H:%M:%SZ'))


def iso(t):
    return _time.strftime('%Y-%m-%dT%H:%M:%SZ', _time.gmtime(t))


def along(lat, lng, secs, step, v=0.00001):
    # Moves north-east at a steady pace: position = start + v * seconds.
    return [(lat + v * t, lng + v * t, t) for t in range(0, secs + 1, step)]


def fit_file(start, pts, compressed_from=None, sport=1):
    semi = lambda d: int(round(d * 2 ** 31 / 180))
    out = bytearray()
    # local 0: record with timestamp, lat, long
    out += bytes([0x40, 0, 0]) + struct.pack('<H', 20) + bytes([3, 253, 4, 0x86, 0, 4, 0x85, 1, 4, 0x85])
    # local 2: record without timestamp, for compressed-timestamp headers
    out += bytes([0x42, 0, 0]) + struct.pack('<H', 20) + bytes([2, 0, 4, 0x85, 1, 4, 0x85])
    for lat, lng, dt in pts:
        ts = start - FIT_EPOCH + dt
        if compressed_from is not None and dt >= compressed_from:
            out += bytes([0x80 | (2 << 5) | (ts & 0x1F)]) + struct.pack('<ii', semi(lat), semi(lng))
        else:
            out += bytes([0x00]) + struct.pack('<Iii', ts, semi(lat), semi(lng))
    # local 1: session with timestamp and sport
    out += bytes([0x41, 0, 0]) + struct.pack('<H', 18) + bytes([2, 253, 4, 0x86, 5, 1, 0x00])
    out += bytes([0x01]) + struct.pack('<IB', start - FIT_EPOCH + pts[-1][2], sport)
    return struct.pack('<BBHI4s', 12, 0x10, 2100, len(out), b'.FIT') + bytes(out) + b'\x00\x00'


def gpx_file(start, pts):
    rows = ''.join(f'<trkpt lat="{la:.6f}" lon="{lo:.6f}"><time>{iso(start + t)}</time></trkpt>' for la, lo, t in pts)
    return (f'<?xml version="1.0"?><gpx creator="StravaGPX" version="1.1" xmlns="http://www.topografix.com/GPX/1/1">'
            f'<trk><name>Porto</name><type>running</type><trkseg>{rows}</trkseg></trk></gpx>').encode()


def tcx_file(start, pts):
    rows = ''.join(f'<Trackpoint><Time>{iso(start + t)}</Time><Position><LatitudeDegrees>{la:.6f}</LatitudeDegrees>'
                   f'<LongitudeDegrees>{lo:.6f}</LongitudeDegrees></Position></Trackpoint>' for la, lo, t in pts)
    return (f'<?xml version="1.0"?><TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">'
            f'<Activities><Activity Sport="Biking"><Lap><Track>{rows}</Track></Lap></Activity></Activities></TrainingCenterDatabase>').encode()


S_WALK = unix('2021-08-14T12:00:00Z')
S_RUN = unix('2021-08-15T12:10:00Z')
S_RIDE = unix('2022-05-01T08:00:00Z')
S_LATE = unix('2021-08-14T13:10:00Z')
strava = {
    'activities/201.fit.gz': gzip.compress(fit_file(S_WALK, along(38.70, -9.16, 3600, 60), sport=11)),
    'activities/202.gpx': gpx_file(S_RUN, along(41.15, -8.63, 1200, 60)),
    'activities/203.tcx.gz': gzip.compress(tcx_file(S_RIDE, along(48.13, 11.56, 1800, 60))),
    # Compressed timestamps from minute 20 on, every 30 seconds.
    'activities/205.fit': fit_file(S_LATE, along(38.72, -9.15, 1140, 60) + along(38.72, -9.15, 1800, 30)[39:], compressed_from=1170, sport=11),
    'media/strava-upload.jpg': jpg((10, 10, 10), 'photo uploaded to Strava', gps=(10.0, 10.0)),
    # A stand-in for the videos in real exports: large, and never to be fetched from Drive.
    'media/strava-upload.mp4': __import__('random').Random(4711).randbytes(300000),
    'profile.csv': b'Athlete ID,Email\n1,someone@example.com\n',
}
head = ['Activity ID', 'Activity Date', 'Activity Name', 'Activity Type', 'Activity Description', 'Elapsed Time', 'Distance',
        'Max Heart Rate', 'Relative Effort', 'Commute', 'Activity Private Note', 'Activity Gear', 'Filename', 'Athlete Weight',
        'Bike Weight', 'Elapsed Time', 'Moving Time', 'Distance', 'Max Speed', 'Average Speed', 'Elevation Gain', 'Elevation Loss']
def row(aid, date, name, kind, desc, secs, km, fname, moving, climb):
    return [aid, date, name, kind, desc, str(secs), f'{km:.2f}', '', '', 'false', '', '', fname, '', '', f'{secs:.1f}',
            f'{moving:.1f}', f'{km * 1000:.1f}', '', '', f'{climb:.1f}', '']
buf = io.StringIO()
w = csv.writer(buf, lineterminator='\n')
w.writerow(head)
w.writerow(row('201', 'Aug 14, 2021, 12:00:00 PM', 'Lisbon walk', 'Walk', '', 3600, 4.2, 'activities/201.fit.gz', 3300, 12))
w.writerow(row('202', 'Aug 15, 2021, 12:10:00 PM', 'Porto run, with a comma', 'Run', 'A "fast" one,\nover two lines', 1200, 3.2, 'activities/202.gpx', 1150, 20))
w.writerow(row('203', 'May 1, 2022, 8:00:00 AM', 'Munich ride', 'Ride', '', 1800, 11.8, 'activities/203.tcx.gz', 1700, 40))
w.writerow(row('204', 'Jan 1, 2023, 10:00:00 AM', 'Gym', 'Weight Training', '', 3000, 0, '', 2800, 0))
w.writerow(row('205', 'Aug 14, 2021, 1:10:00 PM', 'Afternoon walk', 'Walk', '', 1800, 1.9, 'activities/205.fit', 1700, 5))
strava['activities.csv'] = buf.getvalue().encode()

with zipfile.ZipFile('strava-export.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for k, v in strava.items():
        z.writestr(zipfile.ZipInfo(k, (2025, 1, 1, 0, 0, 0)), v, compress_type=zipfile.ZIP_DEFLATED)
for k, v in strava.items():
    p = os.path.join('strava-extracted', 'export_4711', k)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'wb').write(v)
print('strava export ok')
