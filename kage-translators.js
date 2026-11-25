// ---------- Tarjima ----------
async function translate(text,from,to){
  let t=text.replace(/\s+/g,' ').trim();
  {const lt=t.replace(/[^\p{L}]/gu,''),up=lt.replace(/[^\p{Lu}]/gu,'');
   if(lt.length&&up.length/lt.length>=0.7) t=t.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu,(m,a,b)=>a+b.toUpperCase());}
  t=t.slice(0,450);
  try{
    const r=await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(t)}`);
    const j=await r.json();
    const g=(j[0]||[]).map(x=>x[0]).join('');
    if(g) return g;
  }catch(e){}
  for(let k=0;k<2;k++){
    try{
      const r=await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(t)}&langpair=${from}|${to}`);
      const j=await r.json();
      const res=j.responseData&&j.responseData.translatedText;
      if(res&&!/MYMEMORY WARNING|QUERY LENGTH/i.test(res)) return decodeEnt(res);
    }catch(e){}
    await sleep(600);
  }
  return null;
}
function polish(tr,to){
  tr=tr.replace(/\s+/g,' ').trim();
  if(to==='uz') tr=tr.replace(/([OoGg])['’‘`´]/g,'$1ʻ');
  return tr;
}

// ---------- Bir nechta tarjimon (Google, Bing, MyMemory) ----------
const withTimeout=(p,ms)=>Promise.race([p,new Promise((_,r)=>setTimeout(()=>r(new Error('vaqt')),ms||9000))]);
function prepEn(text,from){
  let t=text.replace(/\s+/g,' ').trim();
  const lt=t.replace(/[^\p{L}]/gu,''),up=lt.replace(/[^\p{Lu}]/gu,'');
  if(lt.length&&up.length/lt.length>=0.7){
    t=t.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu,(m,a,b)=>a+b.toUpperCase());
    if(from==='en') t=t.replace(/\bi\b/g,'I');
  }
  return t.slice(0,450);
}
async function trGoogle(t,from,to){
  const r=await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(t)}`);
  const j=await r.json();return (j[0]||[]).map(x=>x[0]).join('');
}
let msTok=null,msExp=0;
async function trBing(t,from,to){
  if(!msTok||Date.now()>msExp){const a=await fetch('https://edge.microsoft.com/translate/auth');msTok=await a.text();msExp=Date.now()+8*60*1000;}
  const r=await fetch(`https://api-edge.cognitive.microsofttranslator.com/translate?from=${from}&to=${to}&api-version=3.0`,
    {method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+msTok},body:JSON.stringify([{Text:t}])});
  const j=await r.json();return j[0].translations[0].text;
}
async function trMyMemory(t,from,to){
  const r=await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(t)}&langpair=${from}|${to}`);
  const j=await r.json();const res=j.responseData&&j.responseData.translatedText;
  if(!res||/MYMEMORY WARNING|QUERY LENGTH/i.test(res)) throw new Error('mm');
  return decodeEnt(res);
}
async function trLingva(t,from,to){
  const r=await fetch(`https://lingva.ml/api/v1/${from}/${to}/${encodeURIComponent(t)}`);
  const j=await r.json();return j.translation;
}
const grams=s=>{s=s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu,'').replace(/\s+/g,' ');const g=new Set();for(let i=0;i<s.length-2;i++)g.add(s.slice(i,i+3));return g;};
const dice=(a,b)=>{if(!a.size||!b.size)return 0;let n=0;for(const x of a)if(b.has(x))n++;return 2*n/(a.size+b.size);};
function pickBest(c){ // eng ko'p tarjimonga o'xshash variant (konsensus)
  if(c.length<3) return c[0].t;
  const g=c.map(x=>grams(x.t));let bi=0,bs=-1;
  c.forEach((x,i)=>{let sc=0;c.forEach((y,j)=>{if(i!==j)sc+=dice(g[i],g[j]);});sc=sc/(c.length-1)+(i===0?0.03:0);if(sc>bs){bs=sc;bi=i;}});
  return c[bi].t;
}
async function translateAll(text,from,to){
  const t=prepEn(text,from);
  const src=[['Google',trGoogle],['Bing',trBing],['MyMemory',trMyMemory]];
  const rs=await Promise.all(src.map(([n,f])=>withTimeout(f(t,from,to)).then(x=>({n,t:polish((x||'').trim(),to)})).catch(()=>null)));
  let c=rs.filter(r=>r&&r.t&&r.t.toLowerCase()!==t.toLowerCase());
  if(!c.length){try{const x=await withTimeout(trLingva(t,from,to));if(x)c=[{n:'Lingva',t:polish(x.trim(),to)}];}catch(e){}}
  if(!c.length) return null;
  const m=new Map();
  for(const r of c){const k=r.t.toLowerCase();if(m.has(k))m.get(k).n+=' + '+r.n;else m.set(k,{n:r.n,t:r.t});}
  return {best:pickBest(c),alts:[...m.values()]};
}

// Rasm tikuvi: to'liq kenglikdagi ingichka to'q chiziqni topib, ikki tomondagi qatorlar bilan to'ldirish
