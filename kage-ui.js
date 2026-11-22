// ---------- Shrift tanlash ----------
function fontOpts(sel,withDefault){
  sel.innerHTML='';
  if(withDefault){const o=document.createElement('option');o.value='';o.textContent='Umumiy shrift';sel.appendChild(o);}
  for(const k in FONTS){const o=document.createElement('option');o.value=k;o.textContent=FONTS[k].n;sel.appendChild(o);}
}
const fontSel=$('fontSel'),fontPrev=$('fontPrev'),fontNote=$('fontNote');
function updPrev(){
  const f=FONTS[GFONT];fontPrev.style.fontFamily=f.css;fontPrev.style.fontWeight=f.w;
  const c=document.createElement('canvas').getContext('2d');
  const ok=GFONT==='sys'||hasGlyph(c,'ʻ',GFONT);
  fontNote.textContent=ok?'Bu shriftda oʻ va gʻ belgilari bor.':'Bu shriftda oʻ/gʻ belgisi yo‘q: ‘ belgisi bilan almashtiriladi.';
}
fontOpts(fontSel,false);fontSel.value=GFONT;
fontsReady.then(updPrev);updPrev();
fontSel.onchange=async()=>{GFONT=fontSel.value;await fontsReady;updPrev();if(state)render();};
$('fontUp').onclick=()=>$('fontFile').click();
$('fontFile').onchange=async e=>{
  const f=e.target.files[0];if(!f) return;
  try{
    const name='KageFont'+(Date.now()%1000000);
    const ff=new FontFace(name,await f.arrayBuffer());await ff.load();document.fonts.add(ff);
    const key='c'+name;
    FONTS[key]={n:f.name.replace(/\.[^.]+$/,''),css:`"${name}","Comic Sans MS",sans-serif`,w:400};
    fontOpts(fontSel,false);GFONT=key;fontSel.value=key;updPrev();
    if(state){buildCards();render();}
  }catch(err){showStatus('Shriftni yuklab bo‘lmadi: '+err.message,'error');}
  e.target.value='';
};

$('applyBtn').addEventListener('click',()=>{render();showStatus('Tarjima rasmga qayta joylandi','loading');});
$('downloadBtn').addEventListener('click',()=>{
  if(pdfDoc) return savePdf();
  canvas.toBlob(bl=>{const a=document.createElement('a');a.href=URL.createObjectURL(bl);a.download='tarjima.png';a.click();});
});
sourceLang.addEventListener('change',()=>{targetLang.value=sourceLang.value==='eng'?'uzb':'eng';});
