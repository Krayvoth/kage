function showStatus(msg,type){statusEl.textContent=msg;statusEl.className='status '+(type||'');}
function loadImg(url){
  return new Promise((res,rej)=>{
    const img=new Image();
    img.onload=()=>res(img);
    img.onerror=()=>rej(new Error('Rasm ochilmadi. Rasmni qayta tanlang.'));
    img.src=url;
  });
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function decodeEnt(s){const t=document.createElement('textarea');t.innerHTML=s;return t.value;}
const lumOf=(d,p)=>(d[p]*299+d[p+1]*587+d[p+2]*114)/1000;
