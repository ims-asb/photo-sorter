// the layout planner: every box inside its page's safe area, nothing overlapping, nothing near the fold
const { JSDOM } = require('jsdom');
let failures = 0;
const check = (l, c, x) => { if (c) console.log('PASS', l); else { failures++; console.log('FAIL', l, x === undefined ? '' : x); } };
(async () => {
  const dom = await JSDOM.fromFile(require('path').join(__dirname,'..','yearbook-planner.html'), { runScripts: 'dangerously', pretendToBeVisual: true });
  const win = dom.window, doc = win.document;
  for (const [n, photos] of [[3, 9], [4, 11], [5, 13]]){
    doc.getElementById('nf').value = String(n);
    doc.getElementById('nf').dispatchEvent(new win.Event('input'));
    const { out, W, H, safe, gut } = win.yearbookPlanner.layout();
    const ph = out.filter(b => b.kind !== 'text');
    check(`${n} frames per page gives ${photos} photos`, ph.length === photos, ph.length);
    const eps = 0.002;   // sizes are rounded to the nearest 0.001 in
    const inside = out.every(b => {
      const left = b.x < W ? [safe, W - gut] : [W + gut, 2 * W - safe];
      return b.x >= left[0] - eps && b.x + b.w <= left[1] + eps && b.y >= safe - eps && b.y + b.h <= H - safe + eps;
    });
    check(`${n}: every box is inside the safe area and off the fold`, inside);
    let overlap = false;
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++){
      const a = out[i], b = out[j];
      if (a.x < b.x + b.w - eps && b.x < a.x + a.w - eps && a.y < b.y + b.h - eps && b.y < a.y + a.h - eps) overlap = true;
    }
    check(`${n}: no boxes overlap`, !overlap);
    const star = out.find(b => b.id === 'Star photo'), tall = out.find(b => b.id === 'Tall photo A');
    const ratio = (star.w * star.h) / (tall.w * tall.h);
    check(`${n}: star photo is about 2.5 times a tall photo`, ratio > 2 && ratio < 3.2, ratio);
  }
  check('copy text lists the boxes', /Star photo:/.test(win.yearbookPlanner.sizesText()));
  check('svg drawn', doc.getElementById('svg').querySelectorAll('rect').length > 20);
  console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
