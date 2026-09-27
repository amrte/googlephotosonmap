# Photo Atlas

See your Google Photos on a map. Photo Atlas is a single HTML file: open it in a
browser, add your Google Takeout export and every photo with a location appears
where it was taken.

Nothing is uploaded. The browser reads your files on your own computer; only the
map background and the page's libraries come from the internet.

## Why Google Takeout

Google doesn't let other apps read where your photos were taken. Since
March 2025 its Photos API no longer lets apps browse your library at all. What
remains after signing in with Google is a photo picker, and it removes the
location from every photo it hands over. Google Takeout is the one official way
to get your photos together with their locations, so that is what Photo Atlas
reads.

## Getting started

1. Download `index.html` and open it in Chrome, Edge, Firefox or Safari
   (double-click is enough).
2. Go to [takeout.google.com](https://takeout.google.com/), click
   **Deselect all**, tick **Google Photos**, then **Next step**. Choose the
   largest file size (50 GB) to get as few ZIP files as possible.
3. Wait for Google's email and download the ZIP files. Don't unzip them.
4. In Photo Atlas, click **Add photos → Takeout ZIP files** and select all the
   ZIPs at once, or drop them onto the page.

The page opens with a made-up demo library so you can try it out first. Adding
your own photos replaces it.

## What you can do

- **Map.** Photos cluster into small stacks with a count. Zoom in and they split
  into single prints; photos taken at exactly the same spot fan out.
  Switch between a minimal map, streets and satellite.
- **Timeline.** A bar per month shows when your photos were taken. Drag across
  it to show one period only.
- **Albums.** Filter by any album from your library.
- **Devices.** Filter by the phone or camera a photo was taken with. The names
  come from each photo's EXIF data, which is read in the background after the
  map appears.
- **In this view.** The side panel lists every photo in the visible part of the
  map, grouped by month. Hovering one marks its spot on the map.
- **Viewer.** Date, coordinates, album, people, description and camera, with
  links to the photo in Google Photos and the place in Google Maps.
- **No location.** Photos without GPS data are counted and listed separately.

## What it understands

- Takeout ZIP files, read directly without unpacking. A 50 GB export works
  because photos are read out of the archive one at a time.
- Unzipped Takeout folders, and ordinary folders of photos.
- Google's metadata files in every naming style Takeout has used
  (`IMG_1.jpg.json`, `IMG_1.jpg.supplemental-metadata.json`, names Google cut
  short, `(1)` duplicates), even when a photo and its metadata ended up in
  different ZIP files.
- GPS positions stored in the photo itself (EXIF), for files without Google's
  metadata.
- Duplicates: a photo that sits in its year folder and in several albums shows
  once, and an edited copy replaces its original.
- Live Photos show once, without the separate movie file. Photos in the trash
  folder are left out.
- JPEG, PNG, WebP, GIF, AVIF, HEIC (converted in the browser when needed),
  videos, and a preview for RAW files where one is embedded.

## Limits

- An internet connection is needed for the map and the libraries.
- Videos, screenshots and photos without EXIF data count as "Unknown device".
- Browsers other than Safari have to convert HEIC photos themselves, which takes
  a moment per photo.
- Very large libraries (100,000+ photos) need a computer with plenty of memory.

## Built with

[Leaflet](https://leafletjs.com) and
[Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) for the
map, [exifr](https://github.com/MikeKovarik/exifr) for EXIF,
[zip.js](https://gildas-lormeau.github.io/zip.js/) for reading ZIP files and
[heic2any](https://github.com/alexcorvi/heic2any) for HEIC. Map tiles by
[CARTO](https://carto.com/attributions) and Esri, map data ©
[OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
