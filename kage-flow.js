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
// Bitta rasmni tarjima qiladi: matn topish -> o'qish -> tarjima. cv: ishchi canvas
async function processImage(url,worker,from,to,cv,say){
  const img=await loadImg(url);
  const W=img.naturalWidth,H=img.naturalHeight;
  cv.width=W;cv.height=H;
  const ctx=cv.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(img,0,0);
  const fixedSeams=repairSeams(ctx,W,H); // skrinshot tikuvi (butun kenglikdagi ingichka qora chiziq)
  const bc=document.createElement('canvas');bc.width=W;bc.height=H;bc.getContext('2d').drawImage(cv,0,0);
  say('matn qidirilmoqda...');
  await sleep(30);
  const det=findTextBlocks(ctx,W,H);
  const blocks=det.blocks,items=[],skipped=[];let failed=0;
  for(let n=0;n<blocks.length;n++){
    if(batchStop&&pdfDoc){bc.width=bc.height=0;return null;}
    say(`matn ${n+1}/${blocks.length} o‘qilmoqda...`);
    const pr=prepBlock(ctx,det,blocks[n]);
    const {w,h,px,bgL,prot}=pr,N=w*h;
    // OCR uchun: chiziq/rasm o'chiriladi, fon tekislanadi
    const cd=new ImageData(w,h),lo=bgL*0.45,hi=bgL*0.75;
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
    const txt=cleanOcr((data.text||'').replace(/[^\p{L}\p{N}'’ʻ".,!?\-:; \n]/gu,' ').replace(/\s+/g,' ').trim());
    const lettersN=txt.replace(/[^\p{L}]/gu,'').length,alnumN=txt.replace(/[^\p{L}\p{N}]/gu,'').length||1;
    if(data.confidence<35||lettersN<2||lettersN/alnumN<0.8||!plausible(txt,data)){
      skipped.push(`@${pr.tx0},${pr.ty0} ${Math.round(data.confidence)}%:${txt.slice(0,14)}`);continue;
    }
    const tr=await translateAll(txt,from,to);
    if(!tr){failed++;continue;}
    const upper=lettersN>0&&txt.replace(/[^\p{Lu}]/gu,'').length/lettersN>=0.7;
    pr.px=null;
    items.push(Object.assign(pr,{en:txt,uz:tr.best,alts:tr.alts,upper,k:1}));
    await sleep(120);
  }
  return {img:bc,ctx,W,H,items,from,to,scale:+$('scale').value/100,upd:[],fixedSeams,nBlocks:blocks.length,skipped,failed};
}
const summary=st=>!st.items.length
  ?`Tarjima qilingan matn topilmadi (${st.nBlocks} ta matn bloki tekshirildi)`+(st.failed?' | tarjima limiti tugagan bo‘lishi mumkin':'')+(st.skipped.length?` | ${st.skipped.slice(0,6).join(' ; ')}`:'')
  :`${st.items.length}/${st.nBlocks} ta matn tarjima qilindi`+(st.fixedSeams?` (${st.fixedSeams} ta tikuv chizig‘i tuzatildi)`:'')+(st.failed?`, ${st.failed} tasi tarjimon xatosi sababli qilinmadi`:'')+(st.skipped.length?` | o‘qilmadi: ${st.skipped.slice(0,4).join(' ; ')}`:'');

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

// PDF: barcha sahifalar ketma-ket avtomatik tarjima qilinadi
async function storePage(n,st,cv){
  const keep=state;state=st;render();state=keep;   // st.ctx = cv
  const final=await blobOf(cv,'image/jpeg',JQ());
  st.img.width=st.img.height=0;
  pages[n]={final,W:st.W,H:st.H,items:st.items,from:st.from,to:st.to,info:summary(st)};
  readerSet(n);
}
// Telefon ekrani o'chib qolmasin (uzoq jarayon uchun)
let _wl=null;
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
  let fatal=null;const N=pdfDoc.numPages,from=sourceLang.value==='eng'?'en':'uz',to=targetLang.value==='eng'?'en':'uz',bad=[];
  try{
    showStatus('OCR tayyorlanmoqda (birinchi marta uzoq bo‘lishi mumkin)...','loading');
    const worker=await getWorker();
    await fontsReady;
    for(let n=1;n<=N&&!batchStop;n++){
      if(pages[n]) continue;                       // oldin tarjima qilingan sahifa
      const say=m=>showStatus(`Sahifa ${n}/${N}: ${m}`,'loading');
      const cv=document.createElement('canvas');let url=null;
      try{
        say('tayyorlanmoqda...');
        url=URL.createObjectURL(await renderPdfPage(n));
        const st=await processImage(url,worker,from,to,cv,say);
        if(!st) break;                             // "To'xtatish" bosildi
        await storePage(n,st,cv);
      }catch(e){console.error(e);bad.push(n);}
      finally{if(url)URL.revokeObjectURL(url);cv.width=cv.height=0;}
      await sleep(30);
    }
  }catch(e){console.error(e);fatal=e;}
  await killWorker();
  const done=Object.keys(pages).length;
  const stopped=batchStop;
  batchRun=false;batchStop=false;translateBtn.disabled=false;stopBtn.style.display='none';keepAwake(false);
  if(fatal){showStatus(explainErr(fatal),'error');updInfo();return;}
  showStatus(stopped?`To‘xtatildi: ${done}/${N} sahifa tarjima qilingan. Davom ettirish uchun tugmani qayta bosing.`
    :`Tayyor: ${done}/${N} sahifa tarjima qilindi.`+(bad.length?` Xato bo‘lgan sahifalar: ${bad.join(', ')} (tugmani qayta bossangiz qayta uriniladi).`:' “PDFni saqlash” ni bosing.'),
    (stopped||bad.length)?'error':'loading');
  updInfo();
}
stopBtn.onclick=()=>{batchStop=true;showStatus('To‘xtatilmoqda (joriy sahifa tugashi kutiladi)...','loading');};

// Reader'dagi sahifani tahrirlash
let _edUrl=null;
async function openEditor(n){
  const pg=pages[n];if(!pg) return;
  try{
    showStatus(`${n}-sahifa ochilmoqda...`,'loading');
    if(_edUrl) URL.revokeObjectURL(_edUrl);
    _edUrl=URL.createObjectURL(await renderPdfPage(n));   // asl sahifa qayta chiziladi (sifat yo'qolmasligi uchun)
    const im=await loadImg(_edUrl);
    const img=document.createElement('canvas');img.width=pg.W;img.height=pg.H;
    const ix=img.getContext('2d',{willReadFrequently:true});ix.drawImage(im,0,0,pg.W,pg.H);repairSeams(ix,pg.W,pg.H);
    canvas.width=pg.W;canvas.height=pg.H;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    state={img,ctx,W:pg.W,H:pg.H,items:pg.items,from:pg.from,to:pg.to,scale:+$('scale').value/100,upd:[],pageNo:n};
    $('editTitle').textContent=`${n}-sahifani tahrirlash`;
    buildCards();await fontsReady;render();
    resultSection.classList.add('show');resultSection.scrollIntoView({behavior:'smooth'});
  }catch(e){showStatus('Sahifani ochib bo‘lmadi: '+e.message,'error');}
}
let _cmT=null;
function schedCommit(){ // tahrirdan keyin sahifa rasmi va reader yangilanadi
  clearTimeout(_cmT);
  _cmT=setTimeout(async()=>{
    if(!state||!state.pageNo||!pages[state.pageNo]) return;
    const n=state.pageNo;
    pages[n].final=await blobOf(canvas,'image/jpeg',JQ());
    readerSet(n);
  },700);
}
