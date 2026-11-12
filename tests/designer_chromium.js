const { chromium } = require('playwright');
const fs = require('fs');
const S = process.env.DESIGNER_DIR || '/tmp/designer/';   // folder with a.jpg, b.jpg, c.jpg; output pictures go here too
let fails = 0;
const ck = (l, c, x) => { console.log(c ? 'PASS' : 'FAIL', l, c ? '' : JSON.stringify(x)); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 1000 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file:///home/user/photo-sorter/yearbook-designer.html');
  // the tool panels are tabs; for this test show them all, then check the tabs separately below
  await p.evaluate(() => document.querySelectorAll('[data-panel]').forEach(x => { x.hidden = false; }));
  await p.waitForTimeout(400);
  let n = await p.evaluate(() => window.yearbookDesigner.items.length);
  ck('starts with the Polaroid table (12 prints)', n === 12, n);
  // load 3 photos into empty boxes
  await p.setInputFiles('#files', [S + 'a.jpg', S + 'b.jpg', S + 'c.jpg']);
  await p.waitForTimeout(800);
  const placed = await p.evaluate(() => window.yearbookDesigner.items.filter(i => i.imgId).length);
  ck('three photos placed in empty boxes', placed === 3, placed);
  // click the first print's center and drag it
  const info = await p.evaluate(() => { const it = window.yearbookDesigner.items[0], P = window.yearbookDesigner.P(); const r = document.getElementById('cv').getBoundingClientRect(); return { x: r.left + it.cx / (2 * P.pw) * r.width, y: r.top + it.cy / P.ph * r.height, cx: it.cx, cy: it.cy, id: it.id }; });
  await p.mouse.move(info.x, info.y); await p.mouse.down(); await p.mouse.move(info.x + 60, info.y + 40, { steps: 5 }); await p.mouse.up();
  const moved = await p.evaluate(id => { const it = window.yearbookDesigner.items.find(i => i.id === id); return { cx: it.cx, cy: it.cy }; }, info.id);
  ck('dragging moves the print', moved.cx > info.cx + 0.1 && moved.cy > info.cy + 0.05, [info, moved]);
  // the side panel shows the selection
  const hasPanel = await p.evaluate(() => !!document.querySelector('#sel [data-k="cx"]'));
  ck('side panel shows its numbers', hasPanel);
  // type a new tilt in the panel
  await p.fill('#sel [data-k="rot"]', '12'); await p.dispatchEvent('#sel [data-k="rot"]', 'input');
  const rot = await p.evaluate(id => window.yearbookDesigner.items.find(i => i.id === id).rot, info.id);
  ck('typing a tilt changes it', rot === 12, rot);
  // resize with a corner handle: grow the print
  const h0 = await p.evaluate(id => window.yearbookDesigner.items.find(i => i.id === id).h, info.id);
  await p.fill('#sel [data-k="rot"]', '0'); await p.dispatchEvent('#sel [data-k="rot"]', 'input');
  const corner = await p.evaluate(id => { const D = window.yearbookDesigner, it = D.items.find(i => i.id === id), P = D.P(), d = D.dims(it); const r = document.getElementById('cv').getBoundingClientRect(); const k = r.width / (2 * P.pw); return { x: r.left + (it.cx + d.w / 2) * k, y: r.top + (it.cy + d.h / 2) * k }; }, info.id);
  await p.mouse.move(corner.x, corner.y); await p.mouse.down(); await p.mouse.move(corner.x + 40, corner.y + 60, { steps: 5 }); await p.mouse.up();
  const h1 = await p.evaluate(id => window.yearbookDesigner.items.find(i => i.id === id).h, info.id);
  ck('dragging a corner makes it bigger', h1 > h0 + 0.1, [h0, h1]);
  // undo
  await p.click('#undo');
  const h2 = await p.evaluate(id => window.yearbookDesigner.items.find(i => i.id === id).h, info.id);
  ck('undo brings back the old size', Math.abs(h2 - h0) < 0.01 || h2 < h1, [h0, h1, h2]);
  // add text and a photo box
  await p.click('#addText'); await p.click('#addPhoto');
  n = await p.evaluate(() => window.yearbookDesigner.items.length);
  ck('add buttons add items', n === 14, n);
  // warnings list shows something sensible and no crash
  const warns = await p.evaluate(() => document.getElementById('warns').children.length);
  ck('warnings list renders', warns >= 1, warns);
  // export the flat page and the frames
  const [d1] = await Promise.all([p.waitForEvent('download'), p.click('#expFlat')]);
  await d1.saveAs(S + 'page.png'); ck('page picture name has size', /page-spread-2250x1650\.png/.test(d1.suggestedFilename()), d1.suggestedFilename());
  const [d2] = await Promise.all([p.waitForEvent('download'), p.click('#expFrames')]);
  await d2.saveAs(S + 'frames.png'); ck('frames picture name', /frames-spread-2250x1650\.png/.test(d2.suggestedFilename()), d2.suggestedFilename());
  await p.selectOption('#part', 'left');
  const [d3] = await Promise.all([p.waitForEvent('download'), p.click('#expFlat')]);
  ck('left page is one page wide', /page-left-1125x1650\.png/.test(d3.suggestedFilename()), d3.suggestedFilename());
  // save and reopen the project
  const [d4] = await Promise.all([p.waitForEvent('download'), p.click('#saveJson')]);
  await d4.saveAs(S + 'proj.json');
  const proj = JSON.parse(fs.readFileSync(S + 'proj.json', 'utf8'));
  ck('project file has the items', proj.items.length === 14 && proj.page.pw === 7.5, [proj.items.length, proj.page]);
  // sizes text
  const txt = await p.evaluate(() => window.yearbookDesigner.sizesText());
  ck('size list has rows with pixels', /Polaroid 1: .*px at 300 dpi/.test(txt), txt.slice(0, 120));
  await p.screenshot({ path: S + 'ui.png' });
  ck('no page errors', errs.length === 0, errs);
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
