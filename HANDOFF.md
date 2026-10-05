# Photo sorter: handoff to Claude Code

## What this is
A single-file, local browser tool ("Tinder for photos") that Luke (ASB Treasurer, Issaquah Middle School) uses to cull event photos for Quah/ASB and the yearbook. Photos stay on the computer. Nothing is uploaded and there are no network calls. Keep it that way: the photos show students, and the district only allows Microsoft-approved tools for anything identifying them. Mz. Weed approved a test run of this tool.

Success test still to do: Luke sorts about 50 photos by hand in OneDrive (timed), then the same 50 in this tool (timed). The tool only earns its place if it is clearly faster or easier.

## Files
- `photo-sorter.html`: the whole app. Vanilla JS in one IIFE, inline CSS, no dependencies.
- `tests/`: jsdom smoke tests plus a fixture generator (see "Running the tests").

## How it works
- **Input:** drag and drop (files, folders, zips), "Choose photos", or "Choose a folder". Chrome or Edge on a computer only (File System Access API).
- **Keys:** Right arrow = keep, Left arrow = reject, Ctrl+Z = undo (repeatable). Buttons do the same. Optional 6th/7th/8th buttons keep and tag a candid (toggle on the start screen, off for assemblies). Held keys are ignored. Reduced motion is respected.
- **Order:** by file modified time, then natural filename sort.
- **Decision codes:** `keep`, `reject`, `g6`, `g7`, `g8`. Stored in localStorage key `photosorter:v2:decisions`, keyed per photo (`name|size|mtime`, zips use `zipname!path|size|mtime`), written with a 250 ms debounce. Dropping the same photos again offers to resume.
- **More photos while sorting:** drop onto the sort screen; they append, duplicates are ignored.
- **Saving:** creates `<Event> - sorted/` with `Keep/`, `6th grade candids/`, `7th grade candids/`, `8th grade candids/`. Rejects are never copied. Originals are never changed. Destination is the chosen folder, or a folder picker at save time for dragged/chosen files. Saving again only adds missing files. The event name is edited in the finish panel.
- **Exports are always JPG or PNG** (teachers cannot open CR2): JPG/PNG are copied untouched. CR2 becomes a JPG from the preview inside it. WebP, GIF, BMP, AVIF are converted to JPG (canvas, quality 0.95, white background). If one photo fails, the rest still save and the failures are listed.
- **CR2:** scans the first 12 MB for baseline or progressive JPEGs (SOF0/1/2), rejects the lossless JPEG that holds the RAW data (SOF3), and takes the largest by pixels. If that is under 1 MP and the file is bigger, it rescans the whole file. Under 300k px it errors ("only a tiny WxH thumbnail"). The camera's TIFF Orientation tag is read and, if not 1, a 36-byte EXIF APP1 block is inserted right after the JPEG's SOI so portrait shots open upright. The filename label shows the preview size.
- **RAW+JPEG pairs:** a CR2 is skipped when a JPG with the same base name and a modified time within 3 s exists.
- **Zips:** custom reader (end-of-central-directory, ZIP64, central directory, `deflate-raw` via DecompressionStream). Entries are unzipped lazily per photo. Skips `__MACOSX`, dotfiles, encrypted entries, and zips inside zips. A broken zip gives a clear message.
- **Skipped types:** HEIC, CR3, NEF, ARW, DNG, TIFF. The top bar counts them.

## Requested next feature: "Needs post processing"
Luke wants a way to mark a photo as "needs post processing" while sorting.

Suggested design (confirm with Luke first, he wants plan-first):
- New decision code `edit` with a button labelled "Needs post processing" and a keyboard shortcut. Suggest the Up arrow, since Left, Right, and Ctrl+Z are taken and the other arrows are free.
- It keeps the photo and saves it to a `Needs post processing/` folder inside the sorted folder. Show its count like the other piles and include it in the finish summary and in undo and resume.
- **Open question for Luke:** can a photo be both a graded candid and need editing? Option A (simplest, recommended): it is its own pile, no grade. Option B: a toggle flag that combines with any keep or grade, saved under `Needs post processing/<pile>/`. Ask one question, then build.
- Exports follow the same JPG/PNG rule.

## Known gaps and things to verify
1. **Never run against a real CR2.** Tests use synthetic CR2 files. Have Luke try CR2s from the 5D Mark III, 5D Mark I, and Rebel T6/T7. Check the preview size, the orientation on portrait shots, and that RAW+JPEG pairs behave.
2. Drag and drop, zips, and CR2 were tested in jsdom only, not in real Chrome. Luke has used the earlier folder-only version.
3. ZIP64 and zips over 4 GB are untested.
4. Auto-grouping photos into events by date and time is not built (idea for later).
5. Only one sorter per computer. Two people sorting at once is not built.
6. Firefox and Safari are unsupported (no File System Access API).

## How Luke likes to work
- Plan first on anything new, then build. For small decisions, state the assumption and proceed.
- No code in chat replies: explain in plain language, put code in files. Short messages, plain text.
- Simplest option wins: the fewest steps and clicks. He dislikes em dashes in text written for him.
- Verify before claiming things work. He has been bitten by untested fixes.

## Running the tests
```
cd tests
npm install            # installs jsdom
python3 make_fixtures.py   # needs Pillow; writes tests/fx/
node test_dragdrop.js
node test_foldermode.js
node test_zip_cr2.js
```
Each prints PASS/FAIL lines and ends with `ALL PASSED`. They load `../photo-sorter.html` and mock the File System Access API. A real-browser check is still needed (see gap 1 and 2).
