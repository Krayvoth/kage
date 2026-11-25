// ---------- Tarjima jarayoni ----------
const ocrWL=()=>sourceLang.value==='eng'?{tessedit_char_whitelist:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'’\".,!?-:;… "}:{};
let _worker=null,_wLang='';
async function killWorker(){if(_worker){try{await _worker.terminate();}catch(e){}_worker=null;}}
async function getWorker(){
  if(_worker&&_wLang===sourceLang.value) return _worker;
  await killWorker();
  const w=await Tesseract.createWorker(sourceLang.value,1);
  await w.setParameters(Object.assign({tessedit_pageseg_mode:'6'},ocrWL()));
  _worker=w;_wLang=sourceLang.value;return w;
}
// OCR natijasidan toza matn: ishonchsiz "chiqindi" so'zlar olib tashlanadi
function ocrText(data){
  const ws=(data.words||[]).filter(w=>w&&typeof w.text==='string'&&w.text.trim());
  const kept=ws.length?ws.filter(keepWord):null;
  const raw=kept?kept.map(w=>w.text).join(' '):(data.text||'');
  const txt=cleanOcr(raw.replace(/[^\p{L}\p{N}'’ʻ".,!?\-:;… \n]/gu,' ').replace(/\s+/g,' ').trim());
  let conf=data.confidence;
  if(kept&&kept.length){let sw=0,sc=0;for(const w of kept){const l=w.text.replace(/[^\p{L}]/gu,'').length||1;sw+=l;sc+=l*w.confidence;}conf=sc/sw;}
  return {txt,conf};
}
const ovl=(a,b)=>{const x=Math.min(a.tx1,b.tx1)-Math.max(a.tx0,b.tx0),y=Math.min(a.ty1,b.ty1)-Math.max(a.ty0,b.ty0);
  return x>0&&y>0?x*y/Math.min((a.tx1-a.tx0)*(a.ty1-a.ty0),(b.tx1-b.tx0)*(b.ty1-b.ty0)):0;};
// Bitta rasmni tarjima qiladi. src: URL yoki canvas. Ikki o'tish: odatiy matn va qora fondagi oq matn
async function processImage(src,worker,from,to,cv,say){
  let W,H,img=null;
  if(typeof src==='string'){img=await loadImg(src);W=img.naturalWidth;H=img.naturalHeight;cv.width=W;cv.height=H;}
  else{W=src.width;H=src.height;}
  const ctx=cv.getContext('2d',{willReadFrequently:true});
  if(img) ctx.drawImage(img,0,0); else if(src!==cv){cv.width=W;cv.height=H;ctx.drawImage(src,0,0);}
  const fixedSeams=repairSeams(ctx,W,H); // skrinshot tikuvi
  const bc=document.createElement('canvas');bc.width=W;bc.height=H;bc.getContext('2d').drawImage(cv,0,0);
  const items=[],skipped=[];let failed=0,nBlocks=0,inverted=false;
  try{
    for(const inv of [false,true]){
      if(inv){invertCanvas(ctx,W,H);inverted=true;}
      say(inv?'oq matn qidirilmoqda...':'matn qidirilmoqda...');
      await sleep(30);
      const det=findTextBlocks(ctx,W,H),blocks=det.blocks;nBlocks+=blocks.length;
      for(let n=0;n<blocks.length;n++){
        if(batchStop&&pdfDoc){bc.width=bc.height=0;return null;}
        say(`${inv?'oq ':''}matn ${n+1}/${blocks.length} o‘qilmoqda...`);
        const pr=prepBlock(ctx,det,blocks[n]);
        if(inv&&items.some(o=>!o.inv&&ovl(o,pr)>0.3)) continue;
        const {w,h,px,bgL,prot}=pr,N=w*h;
        const cd=new ImageData(w,h),lo=bgL*0.45,hi=bgL*0.75; // OCR uchun: chiziq/rasm o'chiriladi, fon tekislanadi
        for(let i=0;i<N;i++){const p=i*4;
          const v=prot[i]?255:Math.max(0,Math.min(255,255*(lumOf(px,p)-lo)/(hi-lo)));
          cd.data[p]=cd.data[p+1]=cd.data[p+2]=v;cd.data[p+3]=255;}
        const c1=document.createElement('canvas');c1.width=w;c1.height=h;c1.getContext('2d').putImageData(cd,0,0);
        const sc=Math.max(0.12,Math.min(44/pr.cap,4,3200/w,3200/h));
        const c2=document.createElement('canvas');c2.width=Math.max(1,Math.round(w*sc));c2.height=Math.max(1,Math.round(h*sc));
        const c2x=c2.getContext('2d');c2x.imageSmoothingQuality='high';c2x.drawImage(c1,0,0,c2.width,c2.height);
        let {data}=await worker.recognize(c2);
        if(data.confidence<55){
          await worker.setParameters({tessedit_pageseg_mode:'11'});
          const r2=await worker.recognize(c2);
          await worker.setParameters({tessedit_pageseg_mode:'6'});
          if(r2.data.confidence>data.confidence) data=r2.data;
        }
        c1.width=c1.height=c2.width=c2.height=0;
        const {txt,conf}=ocrText(data);
        const nTok=txt.split(' ').filter(Boolean).length;
        const lettersN=txt.replace(/[^\p{L}]/gu,'').length,alnumN=txt.replace(/[^\p{L}\p{N}]/gu,'').length||1;
        if(data.confidence<35||conf<58||(nTok<=3&&conf<68)||lettersN<2||lettersN/alnumN<0.8||!plausible(txt,data)){
          skipped.push(`@${pr.tx0},${pr.ty0} ${Math.round(conf)}%:${txt.slice(0,14)}`);continue;
        }
        const tr=await translateAll(txt,from,to);
        if(!tr){failed++;continue;}
        const upper=txt.replace(/[^\p{Lu}]/gu,'').length/lettersN>=0.7;
        pr.px=null;
        items.push(Object.assign(pr,{en:txt,uz:tr.best,alts:tr.alts,upper,k:1,inv}));
        await sleep(120);
      }
      if(inv){invertCanvas(ctx,W,H);inverted=false;}
    }
  }finally{ if(inverted) invertCanvas(ctx,W,H); }
  return {img:bc,ctx,W,H,items,from,to,scale:+$('scale').value/100,upd:[],fixedSeams,nBlocks,skipped,failed};
}
const summary=st=>!st.items.length
  ?`Tarjima qilingan matn topilmadi (${st.nBlocks} ta blok tekshirildi)`+(st.failed?' | tarjima limiti tugagan bo‘lishi mumkin':'')+(st.skipped.length?` | ${st.skipped.slice(0,6).join(' ; ')}`:'')
  :`${st.items.length}/${st.nBlocks} ta matn tarjima qilindi`+(st.fixedSeams?` (${st.fixedSeams} ta tikuv tuzatildi)`:'')+(st.failed?`, ${st.failed} tasi tarjimon xatosi sababli qilinmadi`:'');

// Bitta rasm
translateBtn.addEventListener('click',async()=>{
  if(!selectedUrl) return;
  if(pdfDoc) return translatePdf();
  translateBtn.disabled=true;
  resultSection.classList.remove('show');itemsBox.innerHTML='';$('editTitle').textContent='Natija';
  const from=sourceLang.value==='eng'?'en':'uz',to=targetLang.value==='eng'?'en':'uz';
  try{
    showStatus('OCR tayyorlanmoqda (birinchi marta uzoq bo‘lishi mumkin)...','loading');
    const worker=await getWorker();
    const st=await processImage(selectedUrl,worker,from,to,canvas,m=>showStatus(m,'loading'));
    state=st;buildCards();await fontsReady;render();
    resultSection.classList.add('show');
    showStatus(summary(st),st.items.length?'loading':'error');
    resultSection.scrollIntoView({behavior:'smooth'});
  }catch(err){console.error(err);showStatus(explainErr(err),'error');}
  await killWorker();
  translateBtn.disabled=false;
});

// PDF: sahifalar uzluksiz lentaga ulanadi, qismlarga bo'lib ketma-ket tarjima qilinadi
async function storePage(k,st,cv,segs){
  const keep=state;state=st;render();state=keep;   // st.ctx = cv
  const final=await blobOf(cv,'image/jpeg',JQ());
  st.img.width=st.img.height=0;
  pages[k]={final,W:st.W,H:st.H,items:st.items,from:st.from,to:st.to,info:summary(st),segs};
  readerSet(k);
}
let _wl=null; // telefon ekrani o'chib qolmasin
async function keepAwake(on){
  try{
    if(on&&navigator.wakeLock&&!_wl){_wl=await navigator.wakeLock.request('screen');_wl.addEventListener('release',()=>{_wl=null;});}
    else if(!on&&_wl){await _wl.release();_wl=null;}
  }catch(e){}
}
document.addEventListener('visibilitychange',()=>{if(batchRun&&document.visibilityState==='visible')keepAwake(true);});
async function translatePdf(){
  if(batchRun) return;
  batchRun=true;batchStop=false;translateBtn.disabled=true;stopBtn.style.display='';keepAwake(true);
  let fatal=null;const from=sourceLang.value==='eng'?'en':'uz',to=targetLang.value==='eng'?'en':'uz',bad=[];
  try{
    showStatus('OCR tayyorlanmoqda (birinchi marta uzoq bo‘lishi mumkin)...','loading');
    const worker=await getWorker();
    await fontsReady;
    if(!strip) await stripInit();
    while((strip.carry||strip.nextPage<=strip.N)&&!batchStop){
      const k=strip.k+1;
      const say=m=>showStatus(`Qism ${k} (sahifa ${Math.min(strip.nextPage,strip.N)}/${strip.N}): ${m}`,'loading');
      let ch=null;
      try{
        say('sahifalar ulanmoqda...');
        ch=await nextChunk();
        const st=await processImage(ch.canvas,worker,from,to,ch.canvas,say);
        if(!st){strip.carry={canvas:ch.canvas,segs:ch.segs};ch=null;break;}   // "To'xtatish": bo'lak qaytarib qo'yiladi
        await storePage(k,st,ch.canvas,ch.segs);
      }catch(e){
        console.error(e);bad.push(k);
        if(ch&&ch.canvas.width){ // xato bo'lsa ham o'qish uzilmasin: asl holida saqlanadi
          try{pages[k]={final:await blobOf(ch.canvas,'image/jpeg',JQ()),W:ch.canvas.width,H:ch.canvas.height,items:[],from,to,segs:ch.segs};readerSet(k);}catch(e2){}
        }
      }
      strip.k=k;
      if(ch&&ch.canvas) ch.canvas.width=ch.canvas.height=0;
      await sleep(30);
    }
  }catch(e){console.error(e);fatal=e;}
  await killWorker();
  const N=pdfDoc.numPages,used=strip?Math.min(strip.nextPage-1,N):0,finished=strip&&!strip.carry&&strip.nextPage>strip.N;
  const stopped=batchStop;
  batchRun=false;batchStop=false;translateBtn.disabled=false;stopBtn.style.display='none';keepAwake(false);
  if(fatal){showStatus(explainErr(fatal),'error');updInfo();return;}
  showStatus(stopped&&!finished?`To‘xtatildi: ${used}/${N} sahifa tarjima qilingan. Davom ettirish uchun tugmani qayta bosing.`
    :`Tayyor: ${N} sahifa, ${Object.keys(pages).length} qism.`+(bad.length?` Xato bo‘lgan qismlar: ${bad.join(', ')} (asl holida qoldi).`:' “PDFni saqlash” ni bosing.'),
    (stopped&&!finished)||bad.length?'error':'loading');
  updInfo();
}
stopBtn.onclick=()=>{batchStop=true;showStatus('To‘xtatilmoqda (joriy qism tugashi kutiladi)...','loading');};

// Reader'dagi qismni tahrirlash
async function openEditor(n){
  const pg=pages[n];if(!pg||!pg.segs||!strip) return showStatus('Bu qismni tahrirlab bo‘lmaydi','error');
  try{
    showStatus(`${n}-qism ochilmoqda...`,'loading');
    const img=await rebuildChunk(pg.segs);           // asl qism qayta yig'iladi (sifat yo'qolmasligi uchun)
    repairSeams(img.getContext('2d',{willReadFrequently:true}),pg.W,pg.H);
    canvas.width=pg.W;canvas.height=pg.H;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    state={img,ctx,W:pg.W,H:pg.H,items:pg.items,from:pg.from,to:pg.to,scale:+$('scale').value/100,upd:[],pageNo:n};
    $('editTitle').textContent=`${n}-qismni tahrirlash`;
    buildCards();await fontsReady;render();
    resultSection.classList.add('show');resultSection.scrollIntoView({behavior:'smooth'});
  }catch(e){showStatus('Qismni ochib bo‘lmadi: '+e.message,'error');}
}
let _cmT=null;
function schedCommit(){ // tahrirdan keyin qism rasmi va reader yangilanadi
  clearTimeout(_cmT);
  _cmT=setTimeout(async()=>{
    if(!state||!state.pageNo||!pages[state.pageNo]) return;
    const n=state.pageNo;
    pages[n].final=await blobOf(canvas,'image/jpeg',JQ());
    readerSet(n);
  },700);
}
