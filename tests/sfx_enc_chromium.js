// Real-Chromium check of sfx-converter.html (needs playwright and ffmpeg/ffprobe; test media paths are from the original run). Not part of the quick suite.
const {chromium}=require('playwright'); const fs=require('fs'); const {execFileSync}=require('child_process');
let fails=0; const ok=(l,c,x)=>{ if(c) console.log('PASS',l); else {fails++; console.log('FAIL',l,x===undefined?'':JSON.stringify(x));} };
(async()=>{
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/user/photo-sorter/sfx-converter.html');
const cases=await p.evaluate(()=>{
  let seed=1; const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff};
  const mk=(n,f)=>Int32Array.from({length:n},(_,i)=>Math.max(-32768,Math.min(32767,Math.round(f(i)))));
  const defs={
    'stereo tone+noise, odd length':[mk(100123,i=>12000*Math.sin(i/20)+(rnd()-.5)*800),mk(100123,i=>9000*Math.sin(i/31)+(rnd()-.5)*800)],
    'mono white noise':[mk(50000,()=>(rnd()-.5)*65535)],
    'silence':[mk(30000,()=>0),mk(30000,()=>0)],
    'clipping square wave':[mk(20000,i=>(Math.floor(i/50)%2)?32767:-32768)],
    'exactly two blocks':[mk(8192,i=>8000*Math.sin(i/9)),mk(8192,i=>8000*Math.cos(i/9))],
    'tiny (10 samples)':[mk(10,i=>i*100-300)],
    'one sample':[mk(1,()=>1234)],
    'loud then silent':[mk(30000,i=>i<10000?30000*Math.sin(i/3):0)],
    'long (6 seconds stereo)':[mk(288000,i=>10000*Math.sin(i/40)*Math.sin(i/9000)+(rnd()-.5)*300),mk(288000,i=>10000*Math.sin(i/55)+(rnd()-.5)*300)],
  };
  const res={};
  for(const [name,chs] of Object.entries(defs)){
    const blob=window.sfxConverter.encodeFlac(chs,48000);
    res[name]={chs:chs.map(c=>Array.from(c)),blobP:blob.arrayBuffer().then(ab=>Array.from(new Uint8Array(ab)))};
  }
  return Promise.all(Object.entries(res).map(async([n,v])=>[n,v.chs,await v.blobP]));
});
for(const [name,chs,bytes] of cases){
  fs.writeFileSync('t.flac',Buffer.from(bytes));
  let out; try{ out=execFileSync('ffmpeg',['-v','error','-i','t.flac','-f','s16le','-acodec','pcm_s16le','-'],{maxBuffer:1<<28}); }catch(e){ ok(name+': ffmpeg decodes it',false,String(e.stderr||e.message).slice(0,200)); continue; }
  const n=chs[0].length, c=chs.length; const exp=Buffer.alloc(n*c*2);
  for(let i=0;i<n;i++) for(let k=0;k<c;k++) exp.writeInt16LE(chs[k][i],(i*c+k)*2);
  ok(`${name}: decodes bit for bit (${bytes.length} bytes from ${n*c*2})`, Buffer.compare(out,exp)===0, {got:out.length,want:exp.length});
}
ok('no page errors',errs.length===0,errs);
console.log(fails?fails+' FAILED':'ALL PASSED'); await b.close(); process.exit(fails?1:0);
})();
