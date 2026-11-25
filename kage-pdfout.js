// ---------- PDF yig'ish (kutubxonasiz, JPEG sahifalardan) ----------
function buildPdf(parts,title){
  const enc=new TextEncoder(),chunks=[],offs=[];let len=0;
  const add=x=>{chunks.push(x);len+=(x.size!==undefined?x.size:x.length);};
  const str=t=>enc.encode(t);
  add(new Uint8Array([0x25,0x50,0x44,0x46,0x2D,0x31,0x2E,0x34,0x0A,0x25,0xE2,0xE3,0xCF,0xD3,0x0A]));
  const N=parts.length,nObj=3+3*N;
  const obj=(id,body)=>{offs[id]=len;add(str(`${id} 0 obj\n${body}\nendobj\n`));};
  obj(1,'<</Type/Catalog/Pages 2 0 R>>');
  obj(2,`<</Type/Pages/Count ${N}/Kids[${parts.map((p,i)=>(3+3*i)+' 0 R').join(' ')}]>>`);
  parts.forEach((p,i)=>{
    const pg=3+3*i,ct=4+3*i,im=5+3*i;
    const s=Math.min(1,14000/Math.max(p.w,p.h))*0.5,pw=(p.w*s).toFixed(2),ph=(p.h*s).toFixed(2);
    obj(pg,`<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${pw} ${ph}]/Resources<</XObject<</Im0 ${im} 0 R>>>>/Contents ${ct} 0 R>>`);
    const c=`q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
    obj(ct,`<</Length ${c.length}>>\nstream\n${c}\nendstream`);
    offs[im]=len;
    add(str(`${im} 0 obj\n<</Type/XObject/Subtype/Image/Width ${p.w}/Height ${p.h}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${p.blob.size}>>\nstream\n`));
    add(p.blob);add(str('\nendstream\nendobj\n'));
  });
  const hex=Array.from(String(title||'Kage Translate')).map(ch=>ch.charCodeAt(0).toString(16).padStart(4,'0')).join('');
  obj(nObj,`<</Title<FEFF${hex}>/Producer<FEFF004B0061006700650020005400720061006E0073006C006100740065>>>`);
  const xr=len;
  let x=`xref\n0 ${nObj+1}\n0000000000 65535 f \n`;
  for(let i=1;i<=nObj;i++) x+=String(offs[i]).padStart(10,'0')+' 00000 n \n';
  x+=`trailer\n<</Size ${nObj+1}/Root 1 0 R/Info ${nObj} 0 R>>\nstartxref\n${xr}\n%%EOF\n`;
  add(str(x));
  return new Blob(chunks,{type:'application/pdf'});
}
// Tarjima qilingan qismlardan PDF yig'ish (tugallanmagan qismlar asl holida qo'shiladi)
let _pdfCache=null;
async function makePdfBlob(){
  const K=Object.keys(pages).map(Number).sort((a,b)=>a-b);
  const sig=K.map(k=>k+':'+pages[k].final.size).join(',')+'|'+(strip?strip.nextPage+(strip.carry?'c':''):'-')+'|'+JQ();
  if(_pdfCache&&_pdfCache.sig===sig) return _pdfCache;
  const parts=K.map(k=>({blob:pages[k].final,w:pages[k].W,h:pages[k].H}));let orig=0;
  if(!strip) await stripInit();
  if(strip.carry){
    const b=await blobOf(strip.carry.canvas,'image/jpeg',JQ());
    parts.push({blob:b,w:strip.carry.canvas.width,h:strip.carry.canvas.height});orig++;
  }
  for(let n=strip.nextPage;n<=strip.N;n++){
    showStatus(`PDF yig‘ilmoqda: ${n}/${strip.N}`,'loading');
    const c=await renderStripPage(n),b=await blobOf(c,'image/jpeg',JQ());
    parts.push({blob:b,w:c.width,h:c.height});c.width=c.height=0;orig++;
    await sleep(0);
  }
  const blob=buildPdf(parts,pdfName+' (tarjima)');
  return (_pdfCache={sig,blob,orig,pages:parts.length});
}
async function savePdf(){
  if(!pdfDoc) return;
  if(batchRun) return showStatus('Tarjima tugagach saqlang yoki avval “To‘xtatish” ni bosing','error');
  try{
    const r=await makePdfBlob();
    const a=document.createElement('a');a.href=URL.createObjectURL(r.blob);a.download=`${pdfName}_uz.pdf`;a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),60000);
    showStatus(`PDF saqlandi: ${r.pages} sahifa`+(r.orig?` (${r.orig} qism hali tarjima qilinmagan, asl holida)`:''),'loading');
  }catch(e){console.error(e);showStatus('PDF yig‘ib bo‘lmadi: '+e.message,'error');}
}
$('pdfSaveBtn').onclick=savePdf;
// WhatsApp / Telegram: telefonning ulashish oynasi orqali PDF fayl yuboriladi
async function sharePdf(app){
  if(!pdfDoc) return;
  if(batchRun) return showStatus('Tarjima tugagach ulashing yoki avval “To‘xtatish” ni bosing','error');
  const name=app==='wa'?'WhatsApp':'Telegram';
  try{
    showStatus('PDF tayyorlanmoqda...','loading');
    const r=await makePdfBlob();
    const file=new File([r.blob],`${pdfName}_uz.pdf`,{type:'application/pdf'});
    if(navigator.canShare&&navigator.canShare({files:[file]})){
      try{
        await navigator.share({files:[file],title:pdfName+' (tarjima)'});
        return showStatus(`Ulashish oynasi ochildi: ${name} ni tanlang`,'loading');
      }catch(e){
        if(e&&e.name==='AbortError') return showStatus('Ulashish bekor qilindi','loading');
        if(e&&e.name==='NotAllowedError') return showStatus(`PDF tayyor. ${name} tugmasini yana bir marta bosing`,'loading');
        throw e;
      }
    }
    const a=document.createElement('a');a.href=URL.createObjectURL(r.blob);a.download=`${pdfName}_uz.pdf`;a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),60000);
    window.open(app==='wa'?'https://wa.me/':'https://t.me/','_blank');
    showStatus(`Brauzer faylni to‘g‘ridan-to‘g‘ri ulashishni qo‘llamaydi: PDF saqlandi, ${name} da faylni biriktiring`,'loading');
  }catch(e){console.error(e);showStatus('Ulashib bo‘lmadi: '+e.message,'error');}
}
$('shWa').onclick=()=>sharePdf('wa');
$('shTg').onclick=()=>sharePdf('tg');

let _szT=null;
$('scale').addEventListener('input',()=>{
  const v=+$('scale').value;$('scaleLbl').textContent='Matn hajmi: '+v+'%';
  if(!state) return;
  state.scale=v/100;(state.upd||[]).forEach(f=>f());
  clearTimeout(_szT);_szT=setTimeout(render,120);
});
