// ---------- OCR natijasi haqiqiy matnga o'xshaydimi ----------
const SHORTW=new Set(['no','oh','ah','uh','ok','hi','go','so','me','we','he','it','is','in','on','to','of','or','up','if','by','my','as','at','be','do','an','am','us','i','a']);
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
