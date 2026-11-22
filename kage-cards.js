// ---------- Tahrirlash oynasi ----------
function buildCards(){
  itemsBox.innerHTML='';
  state.items.forEach((it,i)=>{
    const d=document.createElement('div');d.className='item';
    d.innerHTML='<label></label><textarea class="en"></textarea><button class="mini">Qayta tarjima</button><button class="mini sm">A−</button><button class="mini sp">A+</button><span class="szv"></span><select class="fsel"></select><label>Tarjima (tahrirlash mumkin)</label><textarea class="uz"></textarea><div class="alts"></div>';
    const [l1]=d.querySelectorAll('label'),en=d.querySelector('.en'),uz=d.querySelector('.uz'),btn=d.querySelector('.mini'),alts=d.querySelector('.alts');
    l1.textContent=`${i+1}. Asl matn`;
    en.value=it.en;uz.value=it.uz;
    en.oninput=()=>{it.en=en.value;};
    uz.oninput=()=>{it.uz=uz.value;};
    const showAlts=()=>{
      alts.innerHTML='';
      if(!it.alts||it.alts.length<2) return;
      it.alts.forEach(a=>{
        const b=document.createElement('button');b.className='alt';
        const n=document.createElement('b');n.textContent=a.n+': ';
        b.appendChild(n);b.appendChild(document.createTextNode(a.t));
        b.onclick=()=>{it.uz=a.t;uz.value=a.t;};
        alts.appendChild(b);
      });
    };
    showAlts();
    const fs=d.querySelector('.fsel');
    fontOpts(fs,true);fs.value=it.font||'';
    fs.onchange=()=>{it.font=fs.value||undefined;render();};
    const szv=d.querySelector('.szv');
    const upd=()=>{szv.textContent='Hajm: '+Math.round(state.scale*(it.k||1)*100)+'%';};
    upd();(state.upd=state.upd||[]).push(upd);
    d.querySelector('.sm').onclick=()=>{it.k=Math.max(0.4,(it.k||1)*0.92);upd();render();};
    d.querySelector('.sp').onclick=()=>{it.k=Math.min(2,(it.k||1)*1.08);upd();render();};
    btn.onclick=async()=>{
      btn.disabled=true;btn.textContent='...';
      const tr=await translateAll(it.en,state.from,state.to);
      if(tr){it.uz=tr.best;it.alts=tr.alts;uz.value=it.uz;showAlts();}
      btn.disabled=false;btn.textContent='Qayta tarjima';
    };
    itemsBox.appendChild(d);
  });
}
