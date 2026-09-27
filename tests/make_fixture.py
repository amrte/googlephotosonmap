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
