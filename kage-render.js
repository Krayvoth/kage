// ---------- Matnni asl joyiga, asl ko'rinishida joylash ----------
const FONTS={
  neue:{n:'Comic Neue',css:'"Comic Neue","Comic Sans MS",sans-serif',w:700},
  bangers:{n:'Bangers',css:'"Bangers","Comic Sans MS",sans-serif',w:400},
  marker:{n:'Permanent Marker',css:'"Permanent Marker","Comic Sans MS",cursive',w:400},
  neucha:{n:'Neucha',css:'"Neucha","Comic Sans MS",sans-serif',w:400},
  sys:{n:'Standart (tizim)',css:'"Comic Sans MS","Segoe UI",Roboto,Arial,sans-serif',w:700}
};
let CUR='neue',GFONT='neue',CAPR=0.72;
const FONTCSS=(k,s)=>`${FONTS[k].w} ${s}px ${FONTS[k].css}`;
const FONT=s=>FONTCSS(CUR,s);
function useFont(ctx,k){ // shriftni tanlash va bosh harf balandligini o'lchash
  CUR=FONTS[k]?k:'sys';
  ctx.font=FONT(100);
  const a=ctx.measureText('H').actualBoundingBoxAscent;
  CAPR=(a>40&&a<110)?a/100:0.72;
}
const glyphCache={};
function hasGlyph(ctx,ch,k){ // shriftda belgi bormi? (tizim shrifti bilan kengligini solishtiramiz)
  const key=k+ch;if(key in glyphCache) return glyphCache[key];
  ctx.font=FONTCSS(k,60);const a=ctx.measureText(ch).width;
  ctx.font='400 60px sans-serif';const b=ctx.measureText(ch).width;
  return glyphCache[key]=Math.abs(a-b)>0.5;
}
function fixGlyphs(ctx,t){ // oʻ, gʻ belgisi yo'q shriftda ‘ yoki ' ga almashtiramiz
  if(CUR==='sys') return t;
  if(!hasGlyph(ctx,'ʻ',CUR)) t=t.replace(/ʻ/g,'‘');
  if(!hasGlyph(ctx,'‘',CUR)) t=t.replace(/‘/g,"'");
  return t;
}
async function loadFonts(){
  const sample='Oʻzbek gʻoya shahar chiroyli ‘’ ABC xyz';
  await Promise.all(Object.keys(FONTS).filter(k=>k!=='sys').map(k=>document.fonts.load(FONTCSS(k,24),sample).catch(()=>{})));
  for(const k in glyphCache) delete glyphCache[k];
}
const fontsReady=(typeof document!=='undefined'&&document.fonts&&document.fonts.load)?loadFonts():Promise.resolve();
function layoutRect(ctx,text,rw,rh,size0,pitchR){
  const words=text.split(' ').filter(Boolean);
  const mk=(size,forced)=>{
    ctx.font=FONT(size);
    const cap=size*CAPR,pitch=Math.max(cap*1.3,pitchR*cap);
    let mw=0;for(const wd of words) mw=Math.max(mw,ctx.measureText(wd).width);
    if(mw>rw&&!forced) return null;
    const wrap=W=>{const L=[];let cur='';for(const wd of words){const t=cur?cur+' '+wd:wd;if(!cur||ctx.measureText(t).width<=W)cur=t;else{L.push(cur);cur=wd;}}if(cur)L.push(cur);return L;};
    let lines=wrap(rw);
    if(!forced&&(lines.length-1)*pitch+cap>rh) return null;
    let lo=Math.min(mw,rw),hi=rw;
    for(let k=0;k<12;k++){const mid=(lo+hi)/2;if(wrap(mid).length<=lines.length)hi=mid;else lo=mid;}
    lines=wrap(hi);
    return {size,lines,pitch,cap};
  };
  for(let size=Math.max(9,Math.round(size0));size>=9;size--){const r=mk(size,false);if(r) return r;}
  return mk(9,true);
}
// 7-qoida: har bir matnning o'z shakli (qatorlar kengligi) saqlanadi, o'zbekcha matn shu shaklga moslanadi
function layoutProfile(ctx,text,it){
  const words=text.split(' ').filter(Boolean),P=it.prof,m=P?P.length:0,cap0=it.cap;
  if(!words.length||!m) return null;
  const pts=P.map((l,k)=>({t:m===1?0.5:(k+0.5)/m,w:l.x1-l.x0,c:(l.x0+l.x1)/2,x0:l.x0}));
  const at=(t,key)=>{
    if(m===1||t<=pts[0].t) return pts[0][key];
    if(t>=pts[m-1].t) return pts[m-1][key];
    for(let k=0;k<m-1;k++){if(t<=pts[k+1].t){const u=(t-pts[k].t)/(pts[k+1].t-pts[k].t);return pts[k][key]*(1-u)+pts[k+1][key]*u;}}
    return pts[m-1][key];
  };
  const F=(typeof state!=='undefined'&&state?state.scale:0.9)*(it.k||1);
  const cy=(it.ty0+it.ty1)/2,rh=((it.ty1-it.ty0)*1.15+(m===1?2.2:0.9)*cap0)*Math.max(1,F);
  const wcache=new Map(),K=words.length;
  const lw=(a,b)=>{const k=a*200+b;let v=wcache.get(k);if(v===undefined){v=ctx.measureText(words.slice(a,b).join(' ')).width;wcache.set(k,v);}return v;};
  // n qatorga: har bir qator sig'imi asl qator kengligiga mutanosib; so'zlar shaklga eng yaqin taqsimlanadi
  const tryN=(n,f)=>{
    if(K<n) return null;
    const Wc=[];for(let i=0;i<n;i++) Wc.push(at((i+0.5)/n,'w')*1.1*f*F+0.3*cap0*F);
    const INF=1e18,dp=Array.from({length:n+1},()=>Array(K+1).fill(INF)),pr=Array.from({length:n+1},()=>Array(K+1).fill(-1));
    dp[0][0]=0;
    for(let i=1;i<=n;i++)for(let j=i;j<=K;j++)for(let a=i-1;a<j;a++){
      if(dp[i-1][a]>=INF) continue;
      const w=lw(a,j);if(w>Wc[i-1]) continue;
      const c=dp[i-1][a]+(Wc[i-1]-w)*(Wc[i-1]-w);
      if(c<dp[i][j]){dp[i][j]=c;pr[i][j]=a;}
    }
    if(dp[n][K]>=INF) return null;
    const lines=[];let j=K;
    for(let i=n;i>=1;i--){const a=pr[i][j];lines.unshift(words.slice(a,j).join(' '));j=a;}
    return lines;
  };
  for(let size=Math.max(9,Math.round(cap0/CAPR*F));size>=9;size--){
    ctx.font=FONT(size);wcache.clear();
    const cap=size*CAPR,pitch=Math.max(cap*1.3,it.pitchR*cap),nMax=Math.max(1,Math.floor((rh-cap)/pitch)+1);
    for(let n=1;n<=nMax;n++){
      let best=tryN(n,1);if(!best) continue;
      let lo=0.5,hi=1;
      for(let k=0;k<10;k++){const mid=(lo+hi)/2,r=tryN(n,mid);if(r){best=r;hi=mid;}else lo=mid;}
      const nn=best.length,top=cy-((nn-1)*pitch+cap)/2+cap;
      return {size,lines:best.map((q,i)=>({text:q,x:it.align==='left'?at((i+0.5)/nn,'x0'):at((i+0.5)/nn,'c'),y:top+i*pitch}))};
    }
  }
  return null;
}
function eraseItem(ctx,it){
  const {X0,Y0,w,h,bgL,prot,fill,cap}=it;
  const id=ctx.getImageData(X0,Y0,w,h),px=id.data,N=w*h,T=bgL*0.74,m=new Uint8Array(N);
  for(const q of it.rects)for(let y=q.y0;y<q.y1;y++)for(let x=q.ex0;x<q.ex1;x++){ // qator chetidagi nuqtalar (. , ...) ham o'chiriladi
    const i=y*w+x;if(prot[i]||lumOf(px,i*4)>=T) continue;
    if((x>=q.x0&&x<q.x1)||(it.small&&it.small[i])) m[i]=1;
  }
  const r=Math.max(1,Math.round(cap*0.09)),t=new Uint8Array(N),u=new Uint8Array(N);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(m[y*w+x]){for(let k=Math.max(0,x-r);k<=Math.min(w-1,x+r);k++)t[y*w+k]=1;}}
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(t[y*w+x]){for(let k=Math.max(0,y-r);k<=Math.min(h-1,y+r);k++)u[k*w+x]=1;}}
  for(let i=0;i<N;i++){if(u[i]&&!prot[i]){const p=i*4;px[p]=fill[0];px[p+1]=fill[1];px[p+2]=fill[2];}}
  const fl=0.299*fill[0]+0.587*fill[1]+0.114*fill[2];
  if(fl>=232){ // oq fon: eski matnning xira izlarini (soya) tekislash
    for(const q of it.rects)for(let y=q.y0;y<q.y1;y++)for(let x=q.ex0;x<q.ex1;x++){
      const i=y*w+x;if(prot[i]) continue;const p=i*4;
      if(Math.abs(lumOf(px,p)-fl)<=45){px[p]=fill[0];px[p+1]=fill[1];px[p+2]=fill[2];}
    }
  }
  ctx.putImageData(id,X0,Y0);
}
function invertCanvas(ctx,W,H){
  const id=ctx.getImageData(0,0,W,H),d=id.data;
  for(let i=0;i<d.length;i+=4){d[i]=255-d[i];d[i+1]=255-d[i+1];d[i+2]=255-d[i+2];}
  ctx.putImageData(id,0,0);
}
function drawItem(ctx,it){
  useFont(ctx,(it.font&&FONTS[it.font])?it.font:GFONT);
  let text=it.upper?it.uz.toUpperCase():it.uz;
  text=fixGlyphs(ctx,text);
  if(!text.trim()) return;
  const LP=layoutProfile(ctx,text,it);
  if(LP){
    ctx.font=FONT(LP.size);ctx.fillStyle=it.color;ctx.textBaseline='alphabetic';
    ctx.textAlign=it.align==='left'?'left':'center';
    LP.lines.forEach(l=>ctx.fillText(l.text,l.x,l.y));
    return;
  }
  const cx=(it.tx0+it.tx1)/2,cy=(it.ty0+it.ty1)/2,cap=it.cap;
  const f=(state?state.scale:0.9)*(it.k||1); // matn hajmi (umumiy va har bir matn uchun)
  const rw=((it.tx1-it.tx0)*1.12+0.5*cap)*f,rh=((it.ty1-it.ty0)*1.15+(it.nLines===1?2.2:0.9)*cap)*f;
  const L=layoutRect(ctx,text,rw,rh,cap/CAPR*f,it.pitchR);
  const blockH=(L.lines.length-1)*L.pitch+L.cap,top=cy-blockH/2+L.cap;
  ctx.font=FONT(L.size);ctx.fillStyle=it.color;ctx.textBaseline='alphabetic';
  ctx.textAlign=it.align==='left'?'left':'center';
  const x=it.align==='left'?it.tx0:cx;
  L.lines.forEach((l,i)=>ctx.fillText(l,x,top+i*L.pitch));
}
function render(){
  if(!state) return;
  const {ctx,img,items,W,H}=state;
  ctx.drawImage(img,0,0);
  const act=items.filter(it=>it.uz.trim()),A=act.filter(it=>!it.inv),B=act.filter(it=>it.inv);
  A.forEach(it=>eraseItem(ctx,it));
  A.forEach(it=>drawItem(ctx,it));
  if(B.length){ // qora fondagi oq matn: rasm inversiya qilinib ishlanadi
    invertCanvas(ctx,W,H);
    B.forEach(it=>eraseItem(ctx,it));
    B.forEach(it=>drawItem(ctx,it));
    invertCanvas(ctx,W,H);
  }
  if(state&&state.pageNo) schedCommit();
}
