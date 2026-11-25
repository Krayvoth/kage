// PDF sahifasini rasmga (canvas) aylantirish
// Sahifadagi eng katta rasmning asl o'lchamidan masshtabni topish (sifat yo'qolmasligi uchun)
async function nativeScale(page,v1){
  try{
    const ops=await withTimeout(page.getOperatorList(),8000),O=pdfjsLib.OPS;
    let best=0;
    for(let i=0;i<ops.fnArray.length;i++){
      const f=ops.fnArray[i];
      if(f!==O.paintImageXObject&&f!==O.paintJpegXObject) continue;
      const name=ops.argsArray[i][0];
      const im=await withTimeout(new Promise(res=>{try{page.objs.get(name,res);}catch(e){res(null);}}),1500).catch(()=>null);
      if(im&&im.width>best) best=im.width;
    }
    return best/v1.width;
  }catch(e){return 0;}
}
const _pdfSc={};
async function renderPdfPage(n,type,q){
  const page=await pdfDoc.getPage(n),v1=page.getViewport({scale:1});
  if(!_pdfSc[n]){
    let sc=Math.min(4,Math.max(await nativeScale(page,v1),1400/v1.width,1)); // rasmning asl o'lchamidan kam bo'lmasin
    while(v1.width*sc*v1.height*sc>16e6&&sc>0.3) sc*=0.9;                       // juda katta sahifani cheklash
    _pdfSc[n]=sc;
  }
  const vp=page.getViewport({scale:_pdfSc[n]}),c=document.createElement('canvas');
  c.width=Math.round(vp.width);c.height=Math.round(vp.height);
  const cx=c.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,c.width,c.height);
  await page.render({canvasContext:cx,viewport:vp}).promise;
  const blob=await blobOf(c,type||'image/png',q);
  blob.pw=c.width;blob.ph=c.height;c.width=c.height=0;
  if(page.cleanup) page.cleanup();
  return blob;
}
