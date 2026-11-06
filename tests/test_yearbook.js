// the layout planner: every box inside its page's safe area, nothing overlapping, nothing near the fold
const { JSDOM } = require('jsdom');
let failures = 0;
const check = (l, c, x) => { if (c) console.log('PASS', l); else { failures++; console.log('FAIL', l, x === undefined ? '' : x); } };
(async () => {
  const dom = await JSDOM.fromFile(require('path').join(__dirname,'..','yearbook-planner.html'), { runScripts: 'dangerously', pretendToBeVisual: true });
  const win = dom.window, doc = win.document;
  const set = (id, v) => { const e = doc.getElementById(id); e.value = String(v); e.dispatchEvent(new win.Event('input')); };
  const cases = [
    ['straight', { nf: 3 }, 9], ['straight', { nf: 4 }, 11], ['straight', { nf: 5 }, 13],
    ['wind', { nw: 6 }, 14], ['wind', { nw: 0 }, 8], ['wind', { nw: 10 }, 18],
    ['wrap', { nb: 3, nt: 0, ns: 2 }, 13], ['wrap', { nb: 2, nt: 2, ns: 3 }, 17], ['wrap', { nb: 0, nt: 0, ns: 0 }, 3]
  ];
  for (const [mode, opts, photos] of cases){
    set('mode', mode); for (const [k, v] of Object.entries(opts)) set(k, v);
    const { out, W, H, safe, gut } = win.yearbookPlanner.layout();
    const tag = mode + ' ' + JSON.stringify(opts);
    const ph = out.filter(b => b.kind !== 'text');
    check(`${tag}: ${photos} photos`, ph.length === photos, ph.length);
    const eps = 0.002;   // sizes are rounded to the nearest 0.001 in
    const inside = out.every(b => {
      const left = b.x < W ? [safe, W - gut] : [W + gut, 2 * W - safe];
      return b.x >= left[0] - eps && b.x + b.w <= left[1] + eps && b.y >= safe - eps && b.y + b.h <= H - safe + eps;
    });
    check(`${tag}: every box is inside the safe area and off the fold`, inside);
    let overlap = false;
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++){
      const a = out[i], c = out[j];
      if (a.x < c.x + c.w - eps && c.x < a.x + a.w - eps && a.y < c.y + c.h - eps && c.y < a.y + a.h - eps) overlap = true;
    }
    check(`${tag}: no boxes overlap`, !overlap);
    const star = out.find(b => b.id === 'Star photo'), tall = out.find(b => b.id === 'Tall photo A');
    if (star){
      const ratio = (star.w * star.h) / (tall.w * tall.h);
      check(`${tag}: star photo is 1.8 to 3.2 times a tall photo`, ratio > 1.8 && ratio < 3.2, ratio);
    } else {
      const areas = out.filter(x => x.kind === 'photo').map(x => x.w * x.h).sort((a, b) => b - a);
      check(`${tag}: the biggest photo is clearly the biggest`, areas[0] > 1.5 * areas[1], areas.slice(0, 2));
    }
    if (mode === 'wind'){
      const frames = out.filter(x => x.kind === 'frame'), pics = out.filter(x => x.kind === 'photo');
      const hit = (a, c) => a.x0 < c.x1 - eps && c.x0 < a.x1 + -eps && a.y0 < c.y1 - eps && c.y0 < a.y1 - eps;
      const rect = x => ({ x0: x.x, y0: x.y, x1: x.x + x.w, y1: x.y + x.h });
      check(`${tag}: frames are not over photos or each other`, frames.every((f, i) => !pics.some(q => hit(f.bb, rect(q))) && frames.every((g, j) => i === j || !hit(f.bb, g.bb))));
      check(`${tag}: frames stay off the fold and in the safe area`, frames.every(f => (f.bb.x1 <= W - gut + eps || f.bb.x0 >= W + gut - eps) && f.bb.x0 >= safe - eps && f.bb.x1 <= 2 * W - safe + eps && f.bb.y0 >= safe - eps && f.bb.y1 <= H - safe + eps));
      const I = win.yearbookPlanner.layout().info;
      const dist = (b, q) => Math.hypot(Math.max(b.x - q.x, 0, q.x - (b.x + b.w)), Math.max(b.y - q.y, 0, q.y - (b.y + b.h)));
      const close = pics.filter(b => b.id !== 'Photo 8' && I.path.some(q => dist(b, q) < I.T / 2 + 0.05));
      check(`${tag}: no photo touches the strip except the star photo`, close.length === 0, close.map(b => b.id));
      if (opts.nw === 6) check(`${tag}: frames are spread out, not bunched at one end`, frames.length === 6 && (frames[5].x - frames[0].x > 3 || Math.abs(frames[5].y - frames[0].y) > 3), frames.map(f => f.x.toFixed(1) + ',' + f.y.toFixed(1)).join(' '));
    }
    if (mode === 'wrap'){
      const I = win.yearbookPlanner.layout().info, frames = out.filter(b => b.kind === 'frame');
      const clear = ['Star photo', 'Tall photo A', 'Tall photo B', 'Title', 'Caption', 'Paragraph'].every(id => {
        const b = out.find(x => x.id === id);
        return b.x >= I.inner.x - eps && b.y >= I.inner.y - eps && b.x + b.w <= I.inner.x + I.inner.w + eps && b.y + b.h <= I.inner.y + I.inner.h + eps;
      });
      check(`${tag}: photos and text sit inside the ring`, clear);
      const onStrip = frames.every(f => !(f.x >= I.inner.x - eps && f.x + f.w <= I.inner.x + I.inner.w + eps && f.y >= I.inner.y - eps && f.y + f.h <= I.inner.y + I.inner.h + eps));
      check(`${tag}: frames sit on the strip, not inside it`, onStrip);
    }
  }
  // the table of Polaroids
  set('mode', 'table');
  for (const [n, film, tilt, ov] of [[14, 'square', 8, '0.2'], [10, 'mini', 12, '0'], [20, 'classic', 6, '0.4'], [6, 'square', 0, '0.2']]){
    set('tn', n); set('tf', film); set('tt', tilt); set('to', ov);
    const L = win.yearbookPlanner.layout(), { out, W, H, safe, gut } = L, tag = `table ${n} ${film} tilt ${tilt} overlap ${ov}`;
    check(`${tag}: ${n} prints`, out.length === n, out.length);
    const eps = 0.002;
    check(`${tag}: every print is inside the safe area and off the fold`, out.every(b => (b.bb.x1 <= W - gut + eps || b.bb.x0 >= W + gut - eps) && b.bb.x0 >= safe - eps && b.bb.x1 <= 2 * W - safe + eps && b.bb.y0 >= safe - eps && b.bb.y1 <= H - safe + eps));
    const worst = Math.min(...out.map((b, i) => win.yearbookPlanner.visible(out, i)));
    check(`${tag}: every photo window is at least 60% showing`, worst >= 0.6, worst);
    check(`${tag}: tilt stays within the limit`, out.every(b => Math.abs(b.a) <= tilt + 0.001));
    check(`${tag}: window sits inside the print`, out.every(b => b.wx > 0 && b.wy > 0 && b.wx + b.ww < b.pw && b.wy + b.wh < b.ph));
  }
  const first = win.yearbookPlanner.layout().out.map(b => b.cx).join();
  doc.getElementById('shuffle').click();
  check('shuffle gives a different arrangement', win.yearbookPlanner.layout().out.map(b => b.cx).join() !== first);
  check('copy text lists the boxes', /Print 1:/.test(win.yearbookPlanner.sizesText()));
  check('svg drawn', doc.getElementById('svg').querySelectorAll('rect').length > 20);
  console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
