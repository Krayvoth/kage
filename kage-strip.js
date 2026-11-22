// ---------- PDF sahifalarini uzluksiz lentaga ulash (matn sahifa chegarasida kesilmasligi uchun) ----------
let strip=null; // {W,N,nextPage,carry,k}
async function stripInit(){
  const page=await pdfDoc.getPage(1),v1=page.getViewport({scale:1});
  const sc=Math.min(4,Math.max(await nativeScale(page,v1),1400/v1.width,1));
  strip={W:Math.min(2000,Math.round(v1.width*sc)),N:pdfDoc.numPages,nextPage:1,carry:null,k:0};
}
async function renderStripPage(n){
  const page=await pdfDoc.getPage(n),v1=page.getViewport({scale:1});
  const Hp=Math.max(1,Math.round(v1.height*strip.W/v1.width)),vp=page.getViewport({scale:Hp/v1.height});
  const c=document.createElement('canvas');c.width=strip.W;c.height=Hp;
  const cx=c.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,c.width,c.height);
  await page.render({canvasContext:cx,viewport:vp}).promise;
  if(page.cleanup) page.cleanup();
  return c;
}
// lo..hi qatorlar orasidagi eng pastki bo'sh (butun kenglik bo'ylab bir xil rangli) polosa o'rtasi; topilmasa -1
function findGutter(cv,lo,hi){
  const W=cv.width,ctx=cv.getContext('2d',{willReadFrequently:true}),need=Math.max(10,Math.round(W*0.01));
  let run=0,end=-1;
  for(let yb=hi;yb>=lo;yb-=256){
    const ya=Math.max(lo,yb-255),h=yb-ya+1,d=ctx.getImageData(0,ya,W,h).data;
    for(let y=h-1;y>=0;y--){
      let sr=0,sg=0,sb=0,n=0;const b=y*W*4;
      for(let x=0;x<W;x+=2){const p=b+x*4;sr+=d[p];sg+=d[p+1];sb+=d[p+2];n++;}
      const mr=sr/n,mg=sg/n,mb=sb/n;let same=0;
      for(let x=0;x<W;x+=2){const p=b+x*4;if(Math.abs(d[p]-mr)+Math.abs(d[p+1]-mg)+Math.abs(d[p+2]-mb)<=36)same++;}
      if(same/n>=0.99){if(!run)end=ya+y;run++;}
      else{if(run>=need) return end-(run>>1);run=0;}
    }
  }
  return run>=need?end-(run>>1):-1;
}
function splitSegs(segs,cut){
  const top=[],bot=[];let a=0;
  for(const s of segs){
    const b=a+(s.y1-s.y0);
    if(b<=cut) top.push(s);
    else if(a>=cut) bot.push(s);
    else{top.push({p:s.p,y0:s.y0,y1:s.y0+(cut-a)});bot.push({p:s.p,y0:s.y0+(cut-a),y1:s.y1});}
    a=b;
  }
  return [top,bot];
}
// Keyingi bo'lak: oldingi qoldiq + sahifalar ulanadi, bo'sh polosada kesiladi
async function nextChunk(){
  const st=strip,W=st.W,parts=[];let segs=[],total=0;
  if(st.carry){parts.push(st.carry.canvas);segs=segs.concat(st.carry.segs);total+=st.carry.canvas.height;st.carry=null;}
  const target=Math.max(3000,Math.round(9e6/W));
  while(st.nextPage<=st.N&&total<target){
    const c=await renderStripPage(st.nextPage);
    parts.push(c);segs.push({p:st.nextPage,y0:0,y1:c.height});total+=c.height;st.nextPage++;
  }
  const big=document.createElement('canvas');big.width=W;big.height=total;
  const bx=big.getContext('2d',{willReadFrequently:true});let y=0;
  for(const c of parts){bx.drawImage(c,0,y);y+=c.height;c.width=c.height=0;}
  let cut=total;
  if(st.nextPage<=st.N){const g=findGutter(big,Math.round(total*0.3),total-8);if(g>0) cut=g;}
  if(cut>=total) return {canvas:big,segs};
  const [topS,botS]=splitSegs(segs,cut);
  const out=document.createElement('canvas');out.width=W;out.height=cut;out.getContext('2d').drawImage(big,0,0);
  const cc=document.createElement('canvas');cc.width=W;cc.height=total-cut;cc.getContext('2d').drawImage(big,0,-cut);
  big.width=big.height=0;
  st.carry={canvas:cc,segs:botS};
  return {canvas:out,segs:topS};
}
// Tahrirlash uchun bo'lakning asl rasmini qayta yig'ish
async function rebuildChunk(segs){
  const W=strip.W,H=segs.reduce((a,s)=>a+s.y1-s.y0,0);
  const big=document.createElement('canvas');big.width=W;big.height=H;
  const bx=big.getContext('2d',{willReadFrequently:true});let y=0;
  for(const s of segs){const c=await renderStripPage(s.p),h=s.y1-s.y0;bx.drawImage(c,0,s.y0,W,h,0,y,W,h);c.width=c.height=0;y+=h;}
  return big;
}
