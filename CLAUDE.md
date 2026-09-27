# Photo Atlas: notes for working on the code

The whole app is one file, `photoatlas_v0.1.html` (HTML, CSS and JS; no build
step, no framework). `index.html` only forwards to it, so
https://amrte.github.io/googlephotosonmap/ always opens the current release.
GitHub Pages publishes the branch `claude/happy-keller-e6p3g4`.

## Versions

- Every release gets the next number, 0.1 higher: vX.Y -> vX.(Y+1), and after
  .9 the next whole number (0.9 -> 1.0). Never skip a number, never reuse one.
- Once per release, not per commit. Several commits for one release share the
  number; the bump goes into the last of them.
- Don't rename by hand: `python3 tools/bump.py` (`--dry-run` to preview) renames
  the file with `git mv`, updates `VERSION` in it, the target in `index.html`
  and the file name in README.md and this file.
- In examples, write `vX.Y` rather than the current number, or the next bump
  rewrites the example.

## Delivering

When a release is finished (bumped, tested, committed, pushed), attach the page
file in the chat, and check that GitHub Pages published it (the "pages build and
deployment" run).

## Conventions

- UI text in English, short and plain. Dates and numbers go through the en-GB
  formatters at the top of the script.
- Colours only through the CSS tokens on `:root` (light) and their overrides in
  both dark-mode blocks. Sport colours are the exception: fixed, readable on
  every basemap, and defined twice (the `.s-*` classes and `SPORT_COLOR`).
- Libraries come from cdnjs or jsDelivr with pinned versions. When one changes,
  change `LIBS` in `tests/common.cjs` and `tests/package.json` with it.
- Nothing personal goes into the repository. The Strava client secret and all
  sign-ins stay in the user's browser (localStorage). The Google OAuth client
  ID is public by design and built in (`GOOGLE_CLIENT_ID`).
- Google Drive and Strava need the page served over https (or localhost), never
  `file://`; the dialogs say so.
- Photos are records in `S.placed` / `S.unplaced`; after anything changes
  them, `matchActivities()` links them to Strava activities again, then
  `applyFilters()` redraws map, timeline, stats and panel.

## Testing

Before every release, all three browser tests must pass:

```
cd tests && npm install && python3 make_fixture.py && npm test
```

They load the real page in headless Chromium (here at /opt/pw-browsers/chromium;
elsewhere set `PW_CHROMIUM` or let Playwright find its own), serve the CDN
libraries from npm and replace Google and Strava with mocks. Test against what
the feature is for, not against a copy of the code: the fixture export in
`make_fixture.py` holds the awkward cases, and new ones belong there.
