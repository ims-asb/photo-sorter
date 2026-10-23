// Real-Chromium check of sfx-converter.html (needs playwright and ffmpeg/ffprobe; test media paths are from the original run). Not part of the quick suite.
const {chromium}=require('playwright'); const fs=require('fs'); const {execFileSync}=require('child_process');
let fails=0; const ok=(l,c,x)=>{ if(c) console.log('PASS',l); else {fails++; console.log('FAIL',l,x===undefined?'':JSON.stringify(x));} };
(async()=>{
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const ctx=await b.newContext({acceptDownloads:true}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
const reqs=[]; p.on('request',r=>{ if(!/^(file|data|blob):|localhost:8768/.test(r.url())) reqs.push(r.url()); });
await p.addInitScript(()=>{ window.showDirectoryPicker=async()=>{const r=await navigator.storage.getDirectory(); try{await r.removeEntry('sfxout',{recursive:true})}catch(e){} return r.getDirectoryHandle('sfxout',{create:true});}; });
await p.goto('http://localhost:8768/sfx-converter.html');
await p.setInputFiles('#fileInput',['v.webm','v.mp4','a.wav','silent.webm'].map(f=>'/tmp/claude-0/pw/flac/'+f));
ok('four files listed', (await p.$$('#list li')).length===4);
await p.click('#goBtn'); await p.waitForFunction(()=>/converted|failed/.test(document.getElementById('sum').textContent),null,{timeout:60000});
console.log(await p.textContent('#sum')); console.log((await p.$$eval('#list li',l=>l.map(x=>x.textContent))).join('\n'));
const files=await p.evaluate(async()=>{const r=await navigator.storage.getDirectory(); const d=await r.getDirectoryHandle('sfxout'); const o={}; for await(const [n,h] of d.entries()){ o[n]=Array.from(new Uint8Array(await (await h.getFile()).arrayBuffer())); } return o;});
console.log('output files:',Object.keys(files).join(', '));
const probe=(buf)=>{fs.writeFileSync('o.bin',Buffer.from(buf)); return JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_name,channels,sample_rate,duration:stream=codec_type','-of','json','o.bin']).toString());};
ok('webm became a FLAC with a 3 second stereo track', files['v.flac'] && (()=>{const s=probe(files['v.flac']).streams; return s.length===1 && s[0].codec_name==='flac' && s[0].channels===2 && Math.abs(parseFloat(s[0].duration)-3)<0.1;})());
ok('FLAC has no video stream', files['v.flac'] && probe(files['v.flac']).streams.every(s=>s.codec_type==='audio'));
ok('wav was copied unchanged', files['a.wav'] && Buffer.compare(Buffer.from(files['a.wav']),fs.readFileSync('a.wav'))===0);
const mp4=await p.$$eval('#list li',l=>l.map(x=>x.textContent).find(t=>/v\.mp4/.test(t)));
console.log('mp4 (h264+aac) in this Chromium:',mp4);
ok('video with no sound is reported, not crashed', (await p.$$eval('#list li',l=>l.map(x=>x.textContent).find(t=>/silent/.test(t)))).includes('Could not convert'));
ok('no network requests', reqs.length===0, reqs);
ok('no page errors', errs.length===0, errs);
console.log(fails?fails+' FAILED':'ALL PASSED'); await b.close(); process.exit(fails?1:0);
})();
