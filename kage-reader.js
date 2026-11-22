// ---------- Reader: tarjima qilingan qismlar uzluksiz (oq chiziqsiz) o'qiladi ----------
const _io=new IntersectionObserver(es=>{
  for(const e of es){
    const d=e.target,img=d.querySelector('img');d._vis=e.isIntersecting;
    if(e.isIntersecting&&d._url){ if(img.getAttribute('src')!==d._url) img.src=d._url; }
    else if(!e.isIntersecting&&img.getAttribute('src')) img.removeAttribute('src'); // xotirani tejash
  }
},{rootMargin:'1500px 0px'});
function makePg(n){
  const d=document.createElement('div');d.className='pg';d.dataset.n=n;
  d.innerHTML='<span class="tag"></span><button class="mini edit">Tahrirlash</button><img alt="" decoding="async">';
  d.querySelector('.edit').onclick=()=>openEditor(n);
  return d;
}
function buildReader(){readerEl.innerHTML='';updInfo();}
function readerSet(n){
  const pg=pages[n];if(!pg) return;
  let d=readerEl.querySelector(`.pg[data-n="${n}"]`);
  if(!d){d=makePg(n);readerEl.appendChild(d);_io.observe(d);}
  if(d._url) URL.revokeObjectURL(d._url);
  d._url=URL.createObjectURL(pg.final);
  d.style.aspectRatio=pg.W+' / '+pg.H;
  d.querySelector('.tag').textContent='Qism '+n;
  if(d._vis) d.querySelector('img').src=d._url;
  updInfo();
}
function updInfo(){
  if(!pdfDoc) return;
  const K=Object.keys(pages).length,N=pdfDoc.numPages,mid=innerHeight/2;
  let cur=1;
  for(const d of readerEl.children){ if(d.getBoundingClientRect().bottom>mid){cur=+d.dataset.n;break;} }
  const used=strip?Math.min(strip.nextPage-1,N):0;
  rInfo.textContent=K?`Qism ${cur} / ${K} • tarjima qilingan sahifalar: ${used}/${N}`:`PDF: ${N} sahifa • tarjima boshlanmagan`;
}
let _scT=null;
addEventListener('scroll',()=>{clearTimeout(_scT);_scT=setTimeout(updInfo,120);},{passive:true});
