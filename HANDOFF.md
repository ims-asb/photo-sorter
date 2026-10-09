# Photo sorter: handoff to Claude Code

Read this first. It covers what the app is, everything built so far, the current state of GitHub and Pages, what is still open, and how Luke likes to work.

## What this is
A single-file, local browser tool ("Tinder for photos") that Luke (ASB Treasurer, Issaquah Middle School) uses to cull event photos for Quah/ASB and the yearbook. Photos stay on the computer. Nothing is uploaded and there are no network calls (checked: `index.html` has no URLs, fetch, external scripts, or fonts). Keep it that way. The photos show students, and the district only allows Microsoft-approved tools for anything identifying them.

Approval status: Mz. Weed approved a test run. She also sent the question to admin, who sent it to legal. No answer yet. Until legal replies, everything must stay 100% local. No AI of any kind (Mz. Weed rejected the AI sport sorter), no uploads, nothing sent to Claude or any outside service, and do not ask Luke for student photos.

## Where things live
- Repo: `ims-asb/photo-sorter` (public, owned by the personal account `ims-asb`). Default branch `main`.
- Live page: https://ims-asb.github.io/photo-sorter/ (GitHub Pages). It only serves the app's code. Photos never go there. It is served by `.github/workflows/pages.yml` (Pages source set to GitHub Actions) and `.nojekyll`.
- Fully local alternative: download `index.html` and double-click it. Legal-safest for real events.
- Luke wants every update pushed. Push to both `main` and the working branch each time something changes, and tell him when pushing fails.

## Files
- `index.html`: the whole app. Vanilla JS in one IIFE, inline CSS, no dependencies. (It was `photo-sorter.html` in the first handoff and was renamed so Pages can serve it.)
- `tests/`: jsdom smoke tests plus a fixture generator (see "Running the tests").
- `HANDOFF.md`: this file.
- `README.md`: one short paragraph.

## Current state of GitHub access (important)
In the previous session, git pushes and the GitHub tools started returning 403 ("Resource not accessible by integration"). Reads still worked. Reconnecting GitHub did not fix it for that session.
- One commit was never pushed: "Add zoom (Z or click) and on-screen key hints". The live page may still be missing zoom and the key hints.
- Luke was told to either upload the latest `index.html` through GitHub's Add file, Upload files, or start a new session with the repo selected.
- First thing to do in a new session: run `git log --oneline origin/main` and check that `index.html` on `main` contains `id="hints"`. If not, the zoom and hints work has to be redone or applied. The code for them is described below.
- Do not ask Luke to paste a token into chat.

## How it works
- **Input:** drag and drop (files, folders, zips), "Choose photos", or "Choose a folder". Chrome or Edge on a computer only (File System Access API).
- **Start screen:** asks "What photos are these for?" (names the sorted folder, blank falls back to "Photos <date>" or the folder name) and has a box for extra tag buttons (see below).
- **Keys:** Right arrow = keep, Left arrow = reject, 1 to 8 = keep and tag with that button, Up arrow = keep and flag "Needs post processing" in one press, Shift+1 to 8 = tag and flag, Z = zoom, + and - = zoom level, Esc = zoom out, G = go to a photo, Ctrl+Z = undo (repeatable). Buttons do the same. Held keys are ignored. Reduced motion is respected. A line of key hints under the buttons always lists the keys, with the tag range (1-N) for the current event.
- **Order:** by file modified time, then natural filename sort.
- **Decision codes:** `keep`, `reject`, a tag code, plus an optional `+edit` suffix on a keep or tag (for example `g6+edit`, `t:Soccer+edit`). Stored in localStorage key `photosorter:v2:decisions`, keyed per photo (`name|size|mtime`, zips use `zipname!path|size|mtime`), written with a 250 ms debounce. Dropping the same photos again offers to resume. Tag list is remembered in `photosorter:v1:settings`.
- **More photos while sorting:** drop onto the sort screen. They append, duplicates are ignored.
- **Saving:** creates `<Event> - sorted/` with a `Keep/` folder (plain keeps) and one folder per tag. Photos flagged for editing go in `Needs post processing/<pile>/` instead of the normal pile folder. Rejects are never copied. Originals are never changed. Destination is the chosen folder, or a folder picker at save time for dragged or chosen files. Saving again only adds missing files. The event name is editable in the finish panel.
- **Exports are always JPG or PNG** (teachers cannot open CR2 and Canva does not take it): JPG/PNG are copied untouched. CR2 becomes a JPG from the preview inside it. WebP, GIF, BMP, AVIF are converted to JPG (canvas, quality 0.95, white background). If one photo fails, the rest still save and the failures are listed.
- **Memory use:** only about 7 photos are held in memory at once (2 behind, current, 4 ahead). Thousands of photos are fine in principle, but a real run with thousands has not been done.
- **CR2:** scans the first 12 MB for baseline or progressive JPEGs (SOF0/1/2), rejects the lossless JPEG that holds the RAW data (SOF3), and takes the largest by pixels. If that is under 1 MP and the file is bigger, it rescans the whole file. Under 300k px it errors. The camera's TIFF Orientation tag is read and a small EXIF block is added so portrait shots open upright. Luke currently shoots JPG, so this matters less now.
- **RAW+JPEG pairs:** a CR2 is skipped when a JPG with the same base name and a modified time within 3 s exists.
- **Zips:** custom reader (ZIP64, `deflate-raw` via DecompressionStream), lazy per photo. Skips `__MACOSX`, dotfiles, encrypted entries, and zips inside zips.
- **Skipped types:** HEIC, CR3, NEF, ARW, DNG, TIFF. The top bar counts them.

## Features built this round
1. **Needs post processing:** one press. Up arrow (or clicking the blue button) keeps the photo and flags it, and moves on. To flag and tag at once, hold Shift with a number key (Shift+1 to Shift+8) or Shift+click a tag button. A flagged reject just rejects. Counts are shown on the button and in the finish summary ("also counted above"). Undo removes the decision and its flag together. Originally this was a toggle that needed a second key press, and Luke asked for one press (fixed). Test: `test_edit.js`.
2. **Custom tag buttons:** one comma-separated field on the start screen. Quick-fill chips: Grades (the default), Sports (Volleyball, Soccer, Cross country, Basketball), None. Up to 8 tags. Each gets a button, a number key, and a folder named as typed. A trailing "candids" is hidden on the button label. `+` characters are stripped from names because `+` separates the edit flag. Default grade names map to legacy codes `g6/g7/g8`, everything else is `t:<name>`. Why: Luke's batches mix sports (volleyball and soccer on the same day). Test: `test_tags.js`.
3. **Event name on the start screen:** "What photos are these for?" Test: covered in `test_edit.js` and `test_tags.js`.
4. **Undo all:** button in the top bar. Asks first (Cancel is focused), clears every choice, resets to photo 1, clears saved decisions. Does not touch folders already saved. Disabled when nothing is sorted. Test: `test_undoall.js`.
5. **Zoom:** Z or clicking the photo zooms to actual pixel size (at least 2x). The mouse moves the view. Z, Esc, a decision, undo, or any new photo resets it. Checked in real Chromium with a 4000x3000 image. jsdom has no image sizes, so there is no jsdom test for zoom.
6. **Key hints line:** under the buttons, built from the current tag list. Test: in `test_tags.js`.
7. **Bug fixed:** the finish panel summary showed "[object HTMLElement]" because the `el()` helper only flattened children one level. It now flattens fully. This bug was in the original app.
8. **Renamed** `photo-sorter.html` to `index.html` for GitHub Pages.
9. **Go to a photo:** G key or the "Go to" button in the top bar opens a box. Type a photo number and press Enter, or click "First not sorted (N)". Out-of-range numbers keep the box open. Decisions already made are kept. Test: `test_goto.js`.
10. **Sort order:** start screen dropdown, "When they were taken (file date)" (default) or "File name". Remembered. Test: `test_sort.js`.
11. **Logo:** `logo.svg` (green photo card over a red one) and `logo.png` (512 px). It is inline in `index.html` as the browser tab icon (data URI) and as a small mark above the start screen title. No network files.
12. **Folder help:** a tip on the start screen ("Choose a folder" saves the finished folder inside the same folder, nothing to set up), and on the save panel (when photos were dragged in) plain steps for the Chrome window: click New folder, name it, open it, Select Folder, and that Chrome will not accept Desktop, Documents or Downloads themselves. The "could not use that folder" message says the same. A special "Needs post processing" button type was tried and dropped at Luke's request. For one-key combos, Luke types combined buttons such as "Soccer, Soccer needs editing, Volleyball, Volleyball needs editing" in the buttons box.
13. **Simple start, two rounds (Luke's decision, Oct 9):** the start screen shows only the drop zone and "What photos are these for?". The category buttons box and the sort order now live under a "More options" section, and the buttons box always starts empty (it is no longer remembered, and grades are no longer the default; the Grades and Sports quick-fill chips remain). Core use is Right = keep, Left = reject, Up = keep + needs editing. For categories, the finish panel (round 1 with no categories and at least one kept photo) offers "Next: sort the kept photos into categories". That asks for category names, then runs **round 2** over only the kept photos, in memory. Photos flagged in round 1 stay flagged, Right in round 2 means "keep with no category", Reject drops the photo. Nothing is saved between rounds, and round 2 never writes to the browser's saved decisions (the round 1 choices are restored on "Sort more photos"). Everything is saved once at the end, so there are no duplicate folders. Closing the page in round 2 loses round 2 progress. Typing categories in "More options" still gives the one-pass way. Test: `test_round2.js`.
14. **Adjustable zoom (Oct 9):** Z or a click on the photo zooms to 2x (it used to jump to full pixel size, which was too much). While zoomed, + (or =) and - step through 1.5, 2, 3, 4, 6, 8x, and the mouse wheel does the same (one step per 120 ms). One - past 1.5x, Z, Esc, or any decision zooms out. A small badge at the bottom right of the photo shows the level. The level is remembered while the page is open. The mouse position moves the view. Test: `test_zoom.js` (jsdom is told the photo's size by hand). Checked in real Chromium.

## Decisions Luke made (do not re-ask)
- Needs post processing combines with a tag (option B), not its own pile, and must work in one key press.
- Keep the GitHub Pages site on for convenience. Nothing about photos goes to GitHub.
- Ask "What photos are these for?" on the start screen rather than automatic folders.
- Save into a folder inside the OneDrive sync folder. No direct OneDrive connection, and none is wanted. OneDrive's own approved sync uploads the files.
- No AI of any kind. Mz. Weed said no to the AI sport sorter.

## Test results so far
- Luke's friend sorted 50 photos in the tool in 1:10 (about 1.4 s per photo). The OneDrive control run is not done yet. Success test: the tool is clearly faster or easier than sorting the same kind of 50 photos by hand in OneDrive, with the same stopping point (folders exist), the same tags, and fresh photos for each run.
- Luke was going to try it in 5th period on real photos. No bug reports yet.

## Built and then removed at Luke's request (do not re-add unless he asks)
- **Space = repeat the last choice.** Removed: Luke said it invites mistypes.
- **Split a batch into events by time gaps** (ribbon, per-event names and folders). Removed: Luke did not understand it and did not want it.
- **Combine sorted folders from two people** (a start-screen button that merged sorted folders). Removed: Luke did not understand it. Two people can still each sort their own photos on their own computers and drag the folders together in OneDrive by hand.

## Ideas not built (none requested)
1. A one-page how-to for other ASB members.
2. A "maybe" key (probably unnecessary now that the flag exists).
3. **AI sport suggestions: REJECTED.** Mz. Weed said no. Do not build it, do not bring it up again, and do not add any AI model, model download, or outside service to this tool.

## Known gaps and things to verify
1. **Never run against a real CR2.** Tests use synthetic CR2 files. Luke shoots JPG now, but if CR2 comes back, check preview size, portrait orientation, and RAW+JPEG pairs on the 5D Mark III, 5D Mark I, and Rebel T6/T7.
2. Drag and drop, zips, and the real folder picker were only tested in jsdom. Real Chromium was used for screenshots (start screen, sorting screen, finish panel, zoom), with the file input, not the real directory picker.
3. ZIP64 and zips over 4 GB are untested.
4. No run with thousands of photos yet. Luke plans to sort about 1,300 photos off a 128 GB card and 2,000+ off a CompactFlash card. Advice given: copy the photos to the computer first and drag that folder in (not "Choose a folder", which saves the sorted folder inside the chosen folder, possibly onto the card).
5. Chrome blocks saving into top-level folders like Desktop, Documents, Downloads. Use a regular subfolder inside them or inside the OneDrive sync folder.
6. Firefox and Safari are unsupported (no File System Access API).
7. Untested on the school computers: Latitude 3310 and Precision 3680.

## How Luke likes to work
- Plan first on anything new, then build. For small decisions, state the assumption and proceed. Ask one question at a time when something is really his to decide.
- No code in chat replies: explain in plain language, put code in files. Short messages, plain text. He types in short fragments, so check what he means if a request is unclear.
- Simplest option wins: the fewest steps and clicks. He dislikes em dashes in text written for him.
- Verify before claiming things work. He has been bitten by untested fixes. Run all tests, and check UI changes in real Chromium with screenshots where possible.
- Push every update.
- Be honest about limits. Say when something is a guess or when pushing failed.

## Running the tests
```
cd tests
npm install            # installs jsdom
python3 make_fixtures.py   # needs Pillow; writes tests/fx/
node test_dragdrop.js
node test_foldermode.js
node test_zip_cr2.js
node test_edit.js
node test_tags.js
node test_undoall.js
node test_goto.js
node test_sort.js
node test_round2.js
node test_zoom.js
```
Each prints PASS/FAIL lines and ends with `ALL PASSED`. They load `../index.html` and mock the File System Access API. `tests/fx/` and `node_modules/` are git-ignored.

For real-browser checks, Playwright with Chromium at `/opt/pw-browsers/chromium` works with `file:///.../index.html` and `setInputFiles('#fileInput', [...])`.


## 15. Palette matches the ASB hub
The app now uses the hub's dark theme (bg #111110, panels #1c1c1a, borders #2e2d2a, text #f0ede8, green #2ecc87, red #e05555, blue #6b9ff0, yellow #e0b84a) and lists DM Sans first in the font stack. The font is not downloaded (local only), so it only shows if installed; otherwise a system font is used. Logo and favicon recolored to match. Colors live in the :root CSS variables at the top of index.html.


## 16. Event pick list and finish summary
More options has a box for event names (one per line, saved in localStorage key photosorter:v1:events, local only). They show as a pick list on the start screen and in the finish name box; typing your own still works. After saving, the Saved panel shows photos in, kept, rejected, needs post processing, and about how many minutes since the photos were loaded. Nothing connects to the ASB hub (school is Microsoft only). Test: tests/test_events.js.


## 17. WASD keys
D = keep, A = reject, W = keep + needs post processing, S = undo (same as the arrows and Ctrl+Z). The hint bar shows both. Test: tests/test_wasd.js. Note: test_round2.js failed once on a timing race (short sleeps) and passed on every rerun; if it flickers, raise its sleeps.


## 18. Add photos button, remembered photos, big batch check (Oct 9)
- **Add photos** button in the sorting bar (hidden in round 2) opens the file picker and appends to the batch (same path as dropping more).
- **Remembered photos:** the page keeps Chrome file and folder handles (not the photos) in IndexedDB (db photosorter-session). Next visit the start screen shows "Continue <event>?"; one click, Chrome asks permission once, then the usual resume panel appears and decisions come back from localStorage. Cleared by "Forget this" or by "Sort more photos" after saving. Photos must still be in the same place. Handles from the plain file input (old fallback) cannot be remembered. Round 2 is never saved. jsdom has no IndexedDB, so this is checked only in real Chromium (tests/big_batch_chromium.js, which stands in OPFS handles for the pickers; the real permission prompt could not be automated).
- **Big batch:** 2000 JPGs (1.2 MB each) in real Chromium: first photo in under 1 s, median 15 ms from key press to next photo shown (95th percentile 122 ms, max 549 ms), heap about 4 MB, 100 rapid presses all counted, reopen and resume correct.
