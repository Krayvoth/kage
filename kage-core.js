const $=id=>document.getElementById(id);
const uploadArea=$('uploadArea'),fileInput=$('fileInput'),preview=$('preview'),
      translateBtn=$('translateBtn'),statusEl=$('status'),resultSection=$('resultSection'),
      sourceLang=$('sourceLang'),targetLang=$('targetLang'),canvas=$('resultCanvas'),itemsBox=$('items');
let selectedUrl=null,state=null;

uploadArea.addEventListener('click',()=>fileInput.click());
fileInput.addEventListener('change',e=>{if(e.target.files[0])handleFile(e.target.files[0]);});

let pdfDoc=null,pdfName='',pages={},batchStop=false,batchRun=false;
const readerCard=$('readerCard'),readerEl=$('reader'),rInfo=$('rInfo'),stopBtn=$('stopBtn');
const blobOf=(cv,type,q)=>new Promise(r=>cv.toBlob(r,type,q));
const JQ=()=>+($('pdfQ')?$('pdfQ').value:0.95);   // PDF sahifalari JPEG sifati
function explainErr(e){
  const m=String(e&&e.message||e);
  if(/Worker|SecurityError|importScripts|blob-request/i.test(m)) return 'Xatolik: bu oynada (Claude ichidagi ko‘rinish) OCR ishlamaydi, brauzer xavfsizlik cheklovi sabab. Saytni o‘z manzilingizda oching: krayvoth.github.io/MangaTranslate';
  return 'Xatolik: '+m;
}
async function useBlob(blob){
  if(selectedUrl) URL.revokeObjectURL(selectedUrl);
  selectedUrl=URL.createObjectURL(blob);
  preview.src=selectedUrl;preview.style.display='block';
  translateBtn.disabled=false;
}
function setMode(){ // tugmalar nomi tarjima qilinayotgan narsaga qarab o'zgaradi
  $('downloadBtn').textContent=pdfDoc?'PDFni saqlash':'Rasmni saqlash';
  translateBtn.textContent=pdfDoc?'Barcha sahifalarni tarjima qilish':'Tarjima qilish';
  readerCard.style.display=pdfDoc?'block':'none';
}
async function handleFile(file){
  const isPdf=file.type==='application/pdf'||/\.pdf$/i.test(file.name);
  if(!isPdf&&!file.type.startsWith('image/')) return showStatus('Faqat rasm yoki PDF yuklash mumkin','error');
  if(batchRun) return showStatus('Avval joriy tarjima tugashini kuting yoki “To‘xtatish” ni bosing','error');
  try{
    resultSection.classList.remove('show');state=null;pages={};strip=null;readerEl.innerHTML='';
    if(isPdf){
      if(!window.pdfjsLib) return showStatus('PDF kutubxonasi yuklanmadi. Internetni tekshirib, sahifani yangilang.','error');
      showStatus('PDF ochilmoqda...','loading');
      pdfDoc=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
      pdfName=file.name.replace(/\.pdf$/i,'');
      setMode();buildReader();
      await useBlob(await renderPdfPage(1));
      showStatus(`${pdfDoc.numPages} sahifali PDF tayyor. “Barcha sahifalarni tarjima qilish” ni bosing.`,'loading');
    }else{
      pdfDoc=null;setMode();
      await useBlob(new Blob([await file.arrayBuffer()],{type:file.type}));
      showStatus('','');
    }
  }catch(e){ showStatus('Faylni o‘qib bo‘lmadi: '+e.message,'error'); }
}
