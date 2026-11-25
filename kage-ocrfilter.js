// ---------- OCR natijasi haqiqiy matnga o'xshaydimi ----------
const SHORTW=new Set(['no','oh','ah','uh','ok','hi','go','so','me','we','he','it','is','in','on','to','of','or','up','if','by','my','as','at','be','do','an','am','us','i','a','eh','ha','hm','ow','aw','um','er','yo','ya','ye','ay','oi']);
function plausible(txt,data){
  const toks=txt.split(' ').filter(Boolean);
  const good=toks.filter(w=>{
    const l=w.replace(/[^\p{L}]/gu,'');
    return (l.length>=3&&/[aeiouyAEIOUY]/.test(l))||(l.length>=1&&l.length<=2&&SHORTW.has(l.toLowerCase()));
  });
  if(!good.length||good.length/toks.length<0.5) return false;
  const ws=data.words||(data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>(p.lines||[]).flatMap(l=>l.words||[])));
  if(!ws.length) return data.confidence>=40;
  return ws.filter(w=>w.confidence>=55&&w.text.replace(/[^\p{L}]/gu,'').length>=2).length>=1;
}

// Bitta so'z (tesseract natijasi) haqiqiy matnga o'xshaydimi? Tasodifiy 1-2 harfli "chiqindi" so'zlarni olib tashlaydi
const INTERJ=/^(hmm+|shh+|psst?|tsk|brr+|grr+|hm+|mm+|pfft|zzz+|argh+|ugh+|hmph|heh|huh|hah)$/i;
function keepWord(w){
  const t=String(w.text||'').replace(/[^\p{L}\p{N}'’ʻ".,!?\-:;…]/gu,''),l=t.replace(/[^\p{L}]/gu,''),c=w.confidence||0;
  if(!t) return false;
  if(!l.length) return /^(\.{2,}|…|[!?]+)$/.test(t)&&c>=30;
  if(c<30) return false;
  if(l.length<=2&&!SHORTW.has(l.toLowerCase())&&c<88) return false;
  if(l.length>=3&&!/[aeiouy]/i.test(l)&&c<75&&!INTERJ.test(l)) return false;
  return true;
}
