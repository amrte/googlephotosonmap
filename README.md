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

If you'd rather not download the export, choose **Add to Drive** as the
destination in Takeout. Photo Atlas can then read the ZIP files straight from
your Google Drive after you sign in with Google; that needs a one-time setup,
described under [Google Drive setup](#google-drive-setup).

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
- Takeout ZIP files on Google Drive, read in place after signing in with Google.
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
- From Google Drive, each photo's details are a separate small download, so a big
  library takes a few minutes to load. Thumbnails use the small preview stored
  inside each photo, so they are a little softer, and videos get none. Device
  names are only read when you ask, since that means a download per photo.

## Google Drive setup

When Takeout saves your export to Google Drive, Photo Atlas can read it there
after you sign in with Google, without downloading the ZIP files. It asks for
read-only access and reads the files in your browser; nothing goes anywhere
else.

Google sign-in needs two things set up once: the page has to be online at a web
address, and Google has to know about the app. That takes about 15 minutes and
costs nothing.

### 1. Put Photo Atlas online with GitHub Pages

1. On GitHub, open this repository, then **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, pick the
   branch `claude/happy-keller-e6p3g4` and the folder `/ (root)`, and click
   **Save**.
3. A minute or two later the page is at
   <https://amrte.github.io/googlephotosonmap/>.

### 2. Register Photo Atlas with Google

1. Open the [Google Cloud console](https://console.cloud.google.com/) with the
   Google account that holds your photos and create a new project, for example
   "Photo Atlas".
2. Turn on the
   [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com)
   for that project.
3. Open [Google Auth Platform](https://console.cloud.google.com/auth/overview)
   and click **Get started**. Name the app, choose your email as the support
   address, pick **External** as the audience, add your email as the contact
   and create it.
4. Under **Audience**, add your own Google address as a **test user**. Leave
   the app in testing; it doesn't need publishing.
5. Under **Data Access**, add the scope `.../auth/drive.readonly` (search for
   "drive.readonly") and save.
6. Under **Clients**, create a client of type **Web application**. Under
   **Authorized JavaScript origins** add `https://amrte.github.io` (no path, no
   slash at the end). Create it and copy the **Client ID**, which ends in
   `.apps.googleusercontent.com`.

### 3. Sign in

1. Open <https://amrte.github.io/googlephotosonmap/>, click
   **Add photos → From Google Drive** and paste the client ID.
2. Click **Sign in with Google**. Google warns that it hasn't verified the app,
   which is expected for your own app in testing: choose **Continue** and allow
   access to Drive.
3. Pick the export and click **Put on the map**.

The client ID isn't a secret; it only works from the addresses you listed.
Photo Atlas keeps it in your browser. To avoid pasting it on every device, put
it into `GOOGLE_CLIENT_ID` near the top of the script in `index.html`.

Google signs you in for an hour at a time. If that runs out while you browse,
Photo Atlas asks you to sign in again and carries on where it was.

To run it from your own computer instead of GitHub Pages, start
`python3 -m http.server 8000` in the folder with `index.html`, add
`http://localhost:8000` as a second JavaScript origin and open that address.

## Built with

[Leaflet](https://leafletjs.com) and
[Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) for the
map, [exifr](https://github.com/MikeKovarik/exifr) for EXIF,
[zip.js](https://gildas-lormeau.github.io/zip.js/) for reading ZIP files and
[heic2any](https://github.com/alexcorvi/heic2any) for HEIC. Map tiles by
[CARTO](https://carto.com/attributions) and Esri, map data ©
[OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
