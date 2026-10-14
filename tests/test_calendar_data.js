// Checks the typed-in league schedules inside calendar.html for typing mistakes:
// right weekday, every team plays once per date, and every season is a full round robin.
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'calendar.html'), 'utf8');
let failures = 0;
const check = (l, c, x) => { if (c) console.log('PASS', l); else { failures++; console.log('FAIL', l, x === undefined ? '' : x); } };
const TEAMS = ['PL','BL','PC','IM','CM','MW'];
const re = /^\s{2}(\w+):\{ name:'([^']+)'.*?games:`([\s\S]*?)` \}/gm;
const days = { volleyball:[2,4], soccer:[2,4], xc:[4], wrestling:[2,4], girlsbb:[2,4], boysbb:[2,4], track:[4] };
const rounds = { volleyball:2, soccer:2, xc:1, wrestling:2, girlsbb:2, boysbb:2, track:1 };
let m, n = 0;
while ((m = re.exec(html))){
  n++;
  const [, key, name, txt] = m;
  const lines = txt.trim().split('\n');
  const pairs = {}, homes = {};
  let ok = true, why = '';
  for (const line of lines){
    const [d, , gs] = line.split('|');
    const [y, mo, da] = d.split('-').map(Number);
    const wd = new Date(y, mo - 1, da).getDay();
    if (!days[key].includes(wd)){ ok = false; why += ` weekday ${d};`; }
    const games = gs.split(';').map(g => g.split('@'));
    const all = games.flat().sort().join();
    if (games.length !== 3 || all !== TEAMS.slice().sort().join()){ ok = false; why += ` teams ${d};`; }
    for (const [a, h] of games){ const k = [a, h].sort().join(); pairs[k] = (pairs[k] || 0) + 1; homes[a + '@' + h] = (homes[a + '@' + h] || 0) + 1; }
  }
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++){
    const k = [TEAMS[i], TEAMS[j]].sort().join();
    if (pairs[k] !== rounds[key]){ ok = false; why += ` pair ${k}=${pairs[k]};`; }
  }
  if (rounds[key] === 2) for (const a of TEAMS) for (const h of TEAMS) if (a !== h && homes[a + '@' + h] !== 1){ ok = false; why += ` home/away ${a}@${h};`; }
  check(`${name}: ${lines.length} dates look right`, ok, why);
}
check('all 7 sports found', n === 7, n);
console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
process.exit(failures ? 1 : 0);
